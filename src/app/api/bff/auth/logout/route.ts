import type { NextRequest } from 'next/server';

import { BFF_ERROR } from '@/lib/api/errors';
import { callBackend } from '@/lib/server/backend';
import { checkMutation } from '@/lib/server/csrf';
import { getEnv } from '@/lib/server/env';
import { newRequestId } from '@/lib/server/forward';
import { logger } from '@/lib/server/logger';
import { bffError, bffJson } from '@/lib/server/respond';
import { clearSessionCookies, readSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bff/auth/logout
 *
 * Revokes the session at the API (a real server-side revocation) and then removes the
 * cookies. Logout is idempotent: an already-dead session still clears the cookies and
 * still answers 200, so the UI can always leave the authenticated area.
 *
 * If the API is unreachable the cookies are still cleared. The token then stays valid
 * upstream until its TTL — an accepted, documented limitation (docs/SECURITY.md §5).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const requestId = newRequestId();
  const session = await readSession();

  if (!session) {
    const alreadyOut = bffJson(
      200,
      { success: true, message: 'Already signed out', data: null },
      requestId,
    );
    clearSessionCookies(alreadyOut);
    return alreadyOut;
  }

  const csrf = checkMutation(request, session.csrf, env.appOrigin);
  if (!csrf.ok) {
    logger.warn('Blocked logout by CSRF check', { requestId, reason: csrf.reason });
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

  try {
    const upstream = await callBackend({
      method: 'POST',
      path: '/api/v1/auth/logout',
      token: session.token,
      userAgent: request.headers.get('user-agent'),
      requestId,
    });
    if (upstream.status >= 400) {
      logger.warn('Upstream logout did not succeed', { requestId, status: upstream.status });
    }
  } catch (error) {
    logger.warn('Upstream logout failed; clearing the local session anyway', { requestId, error });
  }

  const response = bffJson(200, { success: true, message: 'Signed out', data: null }, requestId);
  clearSessionCookies(response);
  return response;
}
