import 'server-only';

import { getEnv } from './env';

/**
 * Low-level client for the Go API.
 *
 * Invariants enforced here:
 *  - the path is always a fixed string supplied by a route handler, never client input;
 *  - browser cookies are never forwarded upstream;
 *  - every call is time-boxed so a hung API cannot pin a Node worker;
 *  - the upstream response is read as text exactly once, so callers can inspect the
 *    content type before deciding how to parse it.
 */

export class UpstreamTimeoutError extends Error {
  constructor() {
    super('Upstream request timed out');
    this.name = 'UpstreamTimeoutError';
  }
}

export class UpstreamUnreachableError extends Error {
  constructor(cause: unknown) {
    super('Upstream is unreachable');
    this.name = 'UpstreamUnreachableError';
    this.cause = cause;
  }
}

export type BackendRequest = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  /** Fixed path such as `/api/v1/products`. Must start with `/`. */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Opaque bearer token from the encrypted session. */
  token?: string;
  /** Forwarded only for the issue endpoint, which honours it. */
  idempotencyKey?: string;
  /** Browser user agent, truncated, for upstream audit trails. */
  userAgent?: string | null;
  requestId: string;
};

export type BackendResponse = {
  status: number;
  contentType: string;
  bodyText: string;
};

const MAX_USER_AGENT = 255;

function buildUrl(base: string, path: string, query?: BackendRequest['query']): string {
  if (!path.startsWith('/')) {
    throw new Error('Backend path must start with "/"');
  }
  const url = new URL(base + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function callBackend(request: BackendRequest): Promise<BackendResponse> {
  const env = getEnv();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-ID': request.requestId,
  };

  if (request.token) {
    headers.Authorization = `Bearer ${request.token}`;
  }
  if (request.userAgent) {
    headers['User-Agent'] = request.userAgent.slice(0, MAX_USER_AGENT);
  }
  if (request.idempotencyKey) {
    headers['Idempotency-Key'] = request.idempotencyKey;
  }
  if (request.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(env.backendApiUrl, request.path, request.query), {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(env.backendTimeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new UpstreamTimeoutError();
    }
    throw new UpstreamUnreachableError(error);
  }

  const bodyText = await response.text();

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    bodyText,
  };
}
