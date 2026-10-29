'use client';

import type { ApiSuccess } from './envelope';
import { ApiError } from './errors';

/**
 * Browser-side client for the BFF.
 *
 * This is the only place in the app that may call `/api/bff/*`. It:
 *  - attaches the CSRF header on mutations (value read from the readable cookie);
 *  - never sees or handles the backend token (it lives in an httpOnly cookie);
 *  - normalises failures into a single ApiError type.
 */

const CSRF_COOKIE_CANDIDATES = ['__Host-sf_csrf', 'sf_csrf'] as const;

/**
 * Emitted whenever the BFF reports that the session is gone. A single listener
 * (`SessionWatcher`) turns this into exactly one redirect, so N parallel requests
 * cannot cause N navigations.
 */
export const SESSION_EXPIRED_EVENT = 'sf:session-expired';

type CookiesReader = { cookie: string };

/** Reads the CSRF token from the readable cookie, if present. */
export function readCsrfToken(documentLike: CookiesReader | undefined = undefined): string | null {
  const source = documentLike ?? (typeof document === 'undefined' ? undefined : document);
  if (!source) {
    return null;
  }

  for (const name of CSRF_COOKIE_CANDIDATES) {
    const prefix = `${name}=`;
    const entry = source.cookie.split('; ').find((row) => row.startsWith(prefix));
    if (entry) {
      return decodeURIComponent(entry.slice(prefix.length));
    }
  }
  return null;
}

export type BffRequestInit = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
  /** Extra request headers such as `Idempotency-Key`. CSRF and content-type are added here. */
  headers?: Record<string, string>;
};

type RawEnvelope = {
  success?: unknown;
  data?: unknown;
  meta?: unknown;
  message?: unknown;
  error?: { code?: unknown; message?: unknown; details?: unknown };
};

/** Performs a BFF request and unwraps the standard envelope. */
export async function bffRequest<T>(
  path: string,
  init: BffRequestInit = {},
): Promise<ApiSuccess<T, unknown>> {
  const method = init.method ?? 'GET';

  const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
  if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET') {
    const csrf = readCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const response = await fetch(path, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
    cache: 'no-store',
    signal: init.signal,
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    parsed = undefined;
  }

  const envelope = parsed as RawEnvelope | undefined;
  if (!envelope || typeof envelope.success !== 'boolean') {
    throw new ApiError({
      status: response.status,
      code: 'BFF_BAD_RESPONSE',
      message: 'The server returned an unexpected response',
    });
  }

  if (envelope.success !== true) {
    const code = typeof envelope.error?.code === 'string' ? envelope.error.code : 'INTERNAL_ERROR';
    const msg =
      typeof envelope.error?.message === 'string' && envelope.error.message.length > 0
        ? envelope.error.message
        : 'Request failed';

    // One well-known signal instead of per-component redirect logic. The listener
    // (SessionWatcher) de-duplicates, so parallel 401s cannot cause redirect storms.
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }

    throw new ApiError({
      status: response.status,
      code,
      message: msg,
      details: envelope.error?.details,
    });
  }

  return {
    success: true,
    data: envelope.data as T,
    ...(envelope.meta === undefined ? {} : { meta: envelope.meta }),
    ...(typeof envelope.message === 'string' ? { message: envelope.message } : {}),
  };
}

/** True when the failure means "sign in again". */
export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
