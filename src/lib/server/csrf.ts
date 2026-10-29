import type { NextRequest } from 'next/server';

import { secretsMatch } from './session-crypto';

/**
 * CSRF protection.
 *
 * Cookie auth means the browser attaches credentials to any request a page makes,
 * so a hostile site could otherwise trigger mutations. Three independent controls:
 *
 *  1. Session-bound double submit: the client echoes `X-CSRF-Token`, and the server
 *     compares it to the secret stored *inside the encrypted session* — not to a
 *     cookie value. A subdomain that plants a cookie therefore gains nothing.
 *  2. Origin allowlist: browsers set `Origin` and it cannot be forged by page script.
 *  3. JSON-only bodies (enforced in the route handlers): an HTML form cannot send
 *     `Content-Type: application/json` cross-origin without a CORS preflight.
 *
 * Plus `SameSite=Lax` on the session cookie as a first line of defence.
 */

export const CSRF_HEADER = 'x-csrf-token';

/** Why a request was rejected, for logging and for the response body. */
export type CsrfFailure = 'missing-token' | 'token-mismatch' | 'bad-origin' | 'missing-origin';

export type CsrfCheck = { ok: true } | { ok: false; reason: CsrfFailure };

/** Compares the header token with the session-bound secret in constant time. */
export function checkCsrfToken(expected: string, provided: string | null): CsrfCheck {
  if (!provided) {
    return { ok: false, reason: 'missing-token' };
  }
  if (!secretsMatch(expected, provided)) {
    return { ok: false, reason: 'token-mismatch' };
  }
  return { ok: true };
}

/**
 * Verifies that a state-changing request came from our own origin.
 *
 * `Origin` is preferred; `Referer` is a fallback for older clients. If neither is
 * present the request is rejected: an absent Origin on a non-GET request from a
 * browser is not something a legitimate same-origin form/fetch produces.
 */
export function checkOrigin(request: NextRequest, appOrigin: string): CsrfCheck {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const expected = appOrigin.toLowerCase().replace(/\/+$/, '');

  const candidate = origin ?? referer;
  if (!candidate) {
    return { ok: false, reason: 'missing-origin' };
  }

  let parsedOrigin: string;
  try {
    parsedOrigin = new URL(candidate).origin.toLowerCase();
  } catch {
    return { ok: false, reason: 'bad-origin' };
  }

  if (parsedOrigin !== expected) {
    return { ok: false, reason: 'bad-origin' };
  }

  return { ok: true };
}

/** Convenience wrapper: origin first, then the session-bound token. */
export function checkMutation(
  request: NextRequest,
  sessionCsrf: string,
  appOrigin: string,
): CsrfCheck {
  const originCheck = checkOrigin(request, appOrigin);
  if (!originCheck.ok) {
    return originCheck;
  }
  return checkCsrfToken(sessionCsrf, request.headers.get(CSRF_HEADER));
}
