import type { NextRequest } from 'next/server';

import { BFF_ERROR, normalizeUpstreamError, type NormalizedError } from '@/lib/api/errors';
import { callBackend, UpstreamTimeoutError, UpstreamUnreachableError } from '@/lib/server/backend';
import { checkOrigin } from '@/lib/server/csrf';
import { getEnv } from '@/lib/server/env';
import { newRequestId, readJsonBody } from '@/lib/server/forward';
import { logger } from '@/lib/server/logger';
import { FixedWindowLimiter } from '@/lib/server/rate-limit';
import { bffError, bffJson } from '@/lib/server/respond';
import { applySessionCookies } from '@/lib/server/session';
import {
  createCsrfToken,
  SESSION_VERSION,
  toEpochSeconds,
  type SessionRole,
} from '@/lib/server/session-crypto';
import { loginBodySchema, parseBody } from '@/lib/validation/bodies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bff/auth/login
 *
 * Exchanges credentials for a backend session, then stores that session in an
 * encrypted httpOnly cookie. The opaque bearer token is deliberately NOT returned to
 * the browser: the client receives only its own identity and the expiry time.
 */

type Limiters = {
  perIp: FixedWindowLimiter;
  perUsername: FixedWindowLimiter;
};

let limiters: Limiters | undefined;

function getLimiters(): Limiters {
  if (!limiters) {
    const env = getEnv();
    limiters = {
      // A shared address (office NAT, the demo host) legitimately produces several
      // attempts, so the IP budget is looser than the per-username one.
      perIp: new FixedWindowLimiter(env.loginRateLimitMax * 3, env.loginRateLimitWindowMs),
      perUsername: new FixedWindowLimiter(env.loginRateLimitMax, env.loginRateLimitWindowMs),
    };
  }
  return limiters;
}

/**
 * Best-effort client address for rate-limit bucketing only.
 *
 * `x-forwarded-for` is client-spoofable unless a trusted proxy sets it, so it must
 * never drive authorization or audit decisions — only bucket spreading.
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

type UpstreamLogin = {
  token: string;
  expires_at: string;
  user: { id: string; username: string; role: SessionRole };
};

function readUpstreamLogin(data: unknown): UpstreamLogin | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const candidate = data as Record<string, unknown>;
  const user = candidate.user;

  if (typeof candidate.token !== 'string' || candidate.token.length === 0) {
    return null;
  }
  if (typeof candidate.expires_at !== 'string') {
    return null;
  }
  if (typeof user !== 'object' || user === null) {
    return null;
  }

  const account = user as Record<string, unknown>;
  if (
    typeof account.id !== 'string' ||
    typeof account.username !== 'string' ||
    (account.role !== 'ADMIN' && account.role !== 'STOREKEEPER' && account.role !== 'REQUESTER')
  ) {
    return null;
  }

  return {
    token: candidate.token,
    expires_at: candidate.expires_at,
    user: { id: account.id, username: account.username, role: account.role },
  };
}

function fail(error: NormalizedError, requestId: string) {
  return bffError({ ...error, requestId }, requestId);
}

export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const requestId = newRequestId();

  // 1. Login CSRF: an attacker must not be able to sign a victim into the attacker's
  //    account. Origin is browser-set and cannot be forged by page script.
  const origin = checkOrigin(request, env.appOrigin);
  if (!origin.ok) {
    logger.warn('Blocked login by origin check', { requestId, reason: origin.reason });
    return fail(
      {
        status: 403,
        code: BFF_ERROR.CSRF_FAILED,
        message: 'Request blocked by CSRF protection',
        details: { reason: origin.reason },
      },
      requestId,
    );
  }

  // 2. Cheap per-IP throttle before doing any parsing work.
  const ipKey = `ip:${clientIp(request)}`;
  const ipBudget = getLimiters().perIp.consume(ipKey);
  if (!ipBudget.allowed) {
    return fail(
      {
        status: 429,
        code: BFF_ERROR.RATE_LIMITED,
        message: 'Too many sign-in attempts',
        details: { retryAfterSeconds: ipBudget.retryAfterSeconds },
      },
      requestId,
    );
  }

  // 3. Body
  const rawBody = await readJsonBody(request);
  if (!rawBody.ok) {
    return fail(
      rawBody.reason === 'too-large'
        ? { status: 413, code: BFF_ERROR.PAYLOAD_TOO_LARGE, message: 'Request body is too large' }
        : { status: 415, code: BFF_ERROR.BAD_REQUEST, message: 'Expected application/json' },
      requestId,
    );
  }

  const body = parseBody(loginBodySchema, rawBody.text);
  if (!body.ok) {
    return fail(
      body.code === 'BAD_JSON'
        ? { status: 400, code: 'BAD_REQUEST', message: 'Malformed request payload' }
        : {
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'username and password are required',
            details: { fields: body.fields },
          },
      requestId,
    );
  }

  // 4. Per-username throttle (the real brute-force guard from this side).
  const userKey = `user:${body.value.username.toLowerCase()}`;
  const userBudget = getLimiters().perUsername.consume(userKey);
  if (!userBudget.allowed) {
    logger.warn('Blocked login by username throttle', { requestId });
    return fail(
      {
        status: 429,
        code: BFF_ERROR.RATE_LIMITED,
        message: 'Too many sign-in attempts',
        details: { retryAfterSeconds: userBudget.retryAfterSeconds },
      },
      requestId,
    );
  }

  // 5. Upstream
  let upstream;
  try {
    upstream = await callBackend({
      method: 'POST',
      path: '/api/v1/auth/login',
      body: { username: body.value.username, password: body.value.password },
      userAgent: request.headers.get('user-agent'),
      requestId,
    });
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      return fail(
        {
          status: 504,
          code: BFF_ERROR.UPSTREAM_TIMEOUT,
          message: 'The API took too long to respond',
        },
        requestId,
      );
    }
    if (error instanceof UpstreamUnreachableError) {
      logger.error('Upstream unreachable during login', { requestId });
      return fail(
        {
          status: 502,
          code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
          message: 'The API is not reachable',
        },
        requestId,
      );
    }
    logger.error('Unexpected login failure', { requestId, error });
    return fail({ status: 500, code: 'INTERNAL_ERROR', message: 'Sign-in failed' }, requestId);
  }

  // 6. Upstream errors pass through with their own code (INVALID_CREDENTIALS,
  //    TOO_MANY_ATTEMPTS, ...). No cookies are issued on failure.
  if (upstream.status !== 200) {
    const normalized = normalizeUpstreamError(
      upstream.status,
      upstream.contentType,
      upstream.bodyText,
    );
    if (upstream.status >= 500) {
      logger.error('Login upstream error', { requestId, status: upstream.status });
    }
    return fail(normalized, requestId);
  }

  // 7. Success — mint the session cookie. The token never reaches the browser.
  let payload: unknown;
  try {
    payload = JSON.parse(upstream.bodyText);
  } catch {
    payload = undefined;
  }

  const envelope = payload as { success?: boolean; data?: unknown } | undefined;
  const login = envelope?.success === true ? readUpstreamLogin(envelope.data) : null;
  if (!login) {
    logger.error('Login succeeded upstream but the payload was unexpected', { requestId });
    return fail(
      {
        status: 502,
        code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
        message: 'The API returned an unexpected response',
      },
      requestId,
    );
  }

  const exp = toEpochSeconds(login.expires_at);
  if (exp * 1000 <= Date.now()) {
    logger.error('Login returned an already expired session', { requestId });
    return fail(
      {
        status: 502,
        code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
        message: 'Session could not be established',
      },
      requestId,
    );
  }

  const response = bffJson(
    200,
    {
      success: true,
      message: 'Login successful',
      data: {
        user: login.user,
        // Report the same normalised instant that /auth/me returns, so clients never
        // see two different string forms of the same expiry.
        expires_at: new Date(exp * 1000).toISOString(),
      },
    },
    requestId,
  );

  applySessionCookies(response, {
    v: SESSION_VERSION,
    token: login.token,
    exp,
    csrf: createCsrfToken(),
    user: login.user,
  });

  // A successful credential check clears that username's failure budget.
  getLimiters().perUsername.reset(userKey);

  logger.info('Login succeeded', { requestId, userId: login.user.id, role: login.user.role });
  return response;
}
