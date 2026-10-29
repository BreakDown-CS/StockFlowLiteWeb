import type { ApiFailure } from './envelope';

/**
 * Error normalisation shared by the BFF (server) and the browser client.
 *
 * The API answers failures with the standard envelope, but not every response is
 * friendly: unmatched routes and unsupported methods come back as plain text, and a
 * reverse proxy can return an HTML error page. Everything is folded into one shape so
 * the UI has exactly one error handling path.
 */

/** BFF-generated codes (never produced by the API). */
export const BFF_ERROR = {
  NO_SESSION: 'BFF_NO_SESSION',
  SESSION_EXPIRED: 'BFF_SESSION_EXPIRED',
  CSRF_FAILED: 'BFF_CSRF_FAILED',
  BAD_REQUEST: 'BFF_BAD_REQUEST',
  PAYLOAD_TOO_LARGE: 'BFF_PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'BFF_RATE_LIMITED',
  ROUTE_NOT_ALLOWED: 'BFF_ROUTE_NOT_ALLOWED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
} as const;

export type NormalizedError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(error: NormalizedError) {
    super(error.message);
    this.name = 'ApiError';
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
  }

  /** True for failures that may succeed if retried unchanged. */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 502;
  }
}

/** Wraps a normalised error into the standard failure envelope. */
export function envelopeFromError(error: NormalizedError): ApiFailure {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
}

function statusFallback(status: number): { code: string; message: string } {
  if (status === 401) {
    return { code: 'UNAUTHORIZED', message: 'Authentication required' };
  }
  if (status === 403) {
    return { code: 'FORBIDDEN', message: 'Insufficient permissions for this operation' };
  }
  if (status === 404) {
    return { code: 'NOT_FOUND', message: 'The requested resource was not found' };
  }
  if (status === 413) {
    return { code: 'UPSTREAM_PAYLOAD_REJECTED', message: 'The request payload is too large' };
  }
  if (status === 429) {
    return { code: 'TOO_MANY_ATTEMPTS', message: 'Too many requests; please try again later' };
  }
  if (status >= 500) {
    return { code: 'UPSTREAM_ERROR', message: 'The server could not complete the request' };
  }
  return { code: 'BAD_REQUEST', message: 'The request could not be processed' };
}

/**
 * Turns any upstream response into a NormalizedError.
 *
 * @param status HTTP status returned upstream
 * @param contentType raw `content-type` header (may be empty)
 * @param bodyText the body, already read as text
 */
export function normalizeUpstreamError(
  status: number,
  contentType: string,
  bodyText: string,
): NormalizedError {
  const type = contentType.toLowerCase();
  const fallback = statusFallback(status);

  if (type.includes('application/json')) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        (parsed as { success?: unknown }).success === false
      ) {
        const error = (parsed as { error?: unknown }).error;
        if (typeof error === 'object' && error !== null) {
          const candidate = error as Record<string, unknown>;
          const code = typeof candidate.code === 'string' ? candidate.code : fallback.code;
          const message =
            typeof candidate.message === 'string' && candidate.message.length > 0
              ? candidate.message
              : fallback.message;
          return {
            status,
            code,
            message,
            ...(candidate.details === undefined ? {} : { details: candidate.details }),
          };
        }
      }
      return { status, ...fallback };
    } catch {
      return { status, ...fallback };
    }
  }

  if (type.includes('text/html')) {
    // Never echo proxy HTML back to the client.
    return {
      status,
      code: BFF_ERROR.UPSTREAM_UNAVAILABLE,
      message: 'The API gateway returned an unexpected response',
    };
  }

  // Plain text (Fiber's default 404/405/413 handler) or an empty body.
  const trimmed = bodyText.trim();
  const detail = trimmed.length > 0 && trimmed.length <= 200 ? trimmed : undefined;
  return {
    status,
    ...fallback,
    ...(detail === undefined ? {} : { details: { upstream: detail } }),
  };
}
