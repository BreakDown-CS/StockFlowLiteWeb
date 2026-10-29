import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { BFF_ERROR, normalizeUpstreamError } from '@/lib/api/errors';

import { callBackend, UpstreamTimeoutError, UpstreamUnreachableError } from './backend';
import { checkMutation } from './csrf';
import { getEnv } from './env';
import { logger } from './logger';
import { bffError, bffJson } from './respond';
import { clearSessionCookies, readSession, sessionCookieName } from './session';

/**
 * The single path through which every authenticated request reaches the API.
 *
 * Order matters:
 *  1. session  — no valid session means no upstream call at all;
 *  2. CSRF     — origin allowlist plus a session-bound token on every mutation;
 *  3. upstream — token attached server-side, browser cookies never forwarded;
 *  4. response — 401 clears the session, JSON envelopes pass through unchanged,
 *                anything else is normalised into the same envelope shape.
 */

export type ForwardMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

export type ForwardOptions = {
  method: ForwardMethod;
  /** Fixed upstream path. Never derived from client input. */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Forwarded only where the API honours it (stock-request issue). */
  idempotencyKey?: string;
  /**
   * Optional projection for successful JSON envelopes (used by `/auth/me` to add
   * `expires_at` without duplicating the forwarding pipeline).
   */
  mapSuccess?: (data: unknown, meta: unknown) => unknown;
};

/** Request bodies above this size are rejected before reaching the API. */
const MAX_BODY_BYTES = 64 * 1024;

export function newRequestId(): string {
  return crypto.randomUUID();
}

export async function forward(
  request: NextRequest,
  options: ForwardOptions,
): Promise<NextResponse> {
  const env = getEnv();
  const requestId = newRequestId();
  const session = await readSession();

  // 1. Session
  if (!session) {
    const response = bffError(
      { status: 401, code: BFF_ERROR.NO_SESSION, message: 'Authentication required', requestId },
      requestId,
    );
    // Clear a cookie that exists but no longer validates, so the browser stops
    // resending a dead value.
    if (request.cookies.has(sessionCookieName(env.cookieSecure))) {
      clearSessionCookies(response);
    }
    return response;
  }

  // 2. CSRF (all mutations; GET is not expected to change state)
  if (options.method !== 'GET') {
    const csrf = checkMutation(request, session.csrf, env.appOrigin);
    if (!csrf.ok) {
      logger.warn('Blocked request by CSRF check', {
        requestId,
        reason: csrf.reason,
        method: options.method,
      });
      return bffError(
        {
          status: 403,
          code: BFF_ERROR.CSRF_FAILED,
          message: 'Request blocked by CSRF protection',
          details: { reason: csrf.reason },
          requestId,
        },
        requestId,
      );
    }
  }

  // 3. Upstream
  let upstream;
  try {
    upstream = await callBackend({
      method: options.method,
      path: options.path,
      query: options.query,
      body: options.body,
      token: session.token,
      idempotencyKey: options.idempotencyKey,
      userAgent: request.headers.get('user-agent'),
      requestId,
    });
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      logger.warn('Upstream timeout', { requestId, method: options.method });
      return bffError(
        {
          status: 504,
          code: BFF_ERROR.UPSTREAM_TIMEOUT,
          message: 'The API took too long to respond',
          requestId,
        },
        requestId,
      );
    }
    if (error instanceof UpstreamUnreachableError) {
      logger.error('Upstream unreachable', { requestId, method: options.method });
      return bffError(
        {
          status: 502,
          code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
          message: 'The API is not reachable',
          requestId,
        },
        requestId,
      );
    }
    logger.error('Unexpected forwarding failure', { requestId, error });
    return bffError(
      {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to process the request',
        requestId,
      },
      requestId,
    );
  }

  // 4. Response
  if (upstream.status === 401) {
    // Invalid, revoked, expired token or a deactivated account — indistinguishable by
    // design, and handled the same way: drop the session and ask for a fresh login.
    const response = bffError(
      {
        status: 401,
        code: BFF_ERROR.SESSION_EXPIRED,
        message: 'Your session is no longer valid',
        requestId,
      },
      requestId,
    );
    clearSessionCookies(response);
    return response;
  }

  const parsed = tryParseJson(upstream.bodyText);
  if (parsed !== undefined && isEnvelopeLike(parsed)) {
    if (upstream.status >= 500) {
      logger.error('Upstream returned a server error', {
        requestId,
        status: upstream.status,
        code: readErrorCode(parsed),
      });
    }

    const envelope = parsed as Record<string, unknown>;
    if (options.mapSuccess && envelope.success === true) {
      return bffJson(
        upstream.status,
        { ...envelope, data: options.mapSuccess(envelope.data, envelope.meta) },
        requestId,
      );
    }

    return bffJson(upstream.status, parsed, requestId);
  }

  const normalized = normalizeUpstreamError(
    upstream.status,
    upstream.contentType,
    upstream.bodyText,
  );
  logger.warn('Normalised a non-envelope upstream response', {
    requestId,
    status: upstream.status,
    code: normalized.code,
  });
  return bffError({ ...normalized, requestId }, requestId);
}

/** Reads a JSON body with a content-type and size guard. */
export type BodyReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'content-type' | 'too-large' };

export async function readJsonBody(request: NextRequest): Promise<BodyReadResult> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { ok: false, reason: 'content-type' };
  }

  const text = await request.text();
  // Compared in characters, a close-enough proxy for bytes that keeps the check
  // cheap; the API enforces its own hard limit as well.
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, reason: 'too-large' };
  }
  return { ok: true, text };
}

function tryParseJson(text: string): unknown {
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isEnvelopeLike(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { success?: unknown }).success === 'boolean'
  );
}

function readErrorCode(value: unknown): string | undefined {
  const error = (value as { error?: unknown }).error;
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}
