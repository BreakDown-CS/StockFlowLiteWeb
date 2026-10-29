import { BFF_ERROR } from '@/lib/api/errors';
import { callBackend } from '@/lib/server/backend';
import { newRequestId } from '@/lib/server/forward';
import { logger } from '@/lib/server/logger';
import { bffError, bffJson } from '@/lib/server/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/health
 *
 * Unauthenticated liveness probe used by the login screen to tell "the API is down"
 * apart from "your password is wrong" — two very different messages for a user.
 *
 * The API answers `/health` without the envelope, so the result is wrapped here.
 */
export async function GET(): Promise<Response> {
  const requestId = newRequestId();

  try {
    const upstream = await callBackend({ method: 'GET', path: '/health', requestId });

    if (upstream.status !== 200) {
      return bffError(
        {
          status: 503,
          code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
          message: 'The API is not healthy',
          details: { upstreamStatus: upstream.status },
          requestId,
        },
        requestId,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(upstream.bodyText);
    } catch {
      parsed = undefined;
    }

    const body = (parsed ?? {}) as { status?: unknown; service?: unknown };
    return bffJson(
      200,
      {
        success: true,
        data: {
          status: typeof body.status === 'string' ? body.status : 'unknown',
          service: typeof body.service === 'string' ? body.service : 'stockflow-lite',
        },
      },
      requestId,
    );
  } catch (error) {
    logger.warn('Health probe failed', { requestId, error });
    return bffError(
      {
        status: 503,
        code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
        message: 'The API is not reachable',
        requestId,
      },
      requestId,
    );
  }
}
