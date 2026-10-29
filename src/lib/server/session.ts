import 'server-only';

import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

import { getEnv } from './env';
import { logger } from './logger';
import {
  isSessionExpired,
  openSession,
  sealSession,
  SessionDecodeError,
  type SessionPayload,
} from './session-crypto';

/**
 * Session cookie handling.
 *
 * Cookie naming:
 *  - production uses the `__Host-` prefix, which forces `Secure`, `Path=/` and no
 *    `Domain`, so a sibling subdomain cannot shadow the cookie;
 *  - development drops the prefix because the dev server runs on plain HTTP.
 *
 * The name is derived from `SESSION_COOKIE_SECURE`, so the two can never diverge.
 */

const SESSION_COOKIE = 'sf_session';
const CSRF_COOKIE = 'sf_csrf';
const HOST_PREFIX = '__Host-';

export function sessionCookieName(secure: boolean): string {
  return secure ? `${HOST_PREFIX}${SESSION_COOKIE}` : SESSION_COOKIE;
}

export function csrfCookieName(secure: boolean): string {
  return secure ? `${HOST_PREFIX}${CSRF_COOKIE}` : CSRF_COOKIE;
}

/**
 * Reads and validates the session cookie.
 *
 * @returns the payload, or null when the cookie is missing, tampered, foreign-keyed,
 * expired or unreadable. Callers must treat null as "not signed in" — never as a
 * partial identity.
 */
export async function readSession(): Promise<SessionPayload | null> {
  const env = getEnv();
  const store = await cookies();
  const raw = store.get(sessionCookieName(env.cookieSecure))?.value;

  if (!raw) {
    return null;
  }

  try {
    const payload = openSession(raw, env.sessionSecret);
    if (isSessionExpired(payload)) {
      return null;
    }
    return payload;
  } catch (error) {
    // A tampered or stale cookie is expected noise (key rotation, old version).
    logger.warn('Rejected session cookie', {
      reason: error instanceof SessionDecodeError ? error.message : 'unexpected error',
    });
    return null;
  }
}

function maxAgeSeconds(payload: SessionPayload): number {
  const remaining = payload.exp - Math.floor(Date.now() / 1000);
  return Math.max(0, remaining);
}

/** Writes both cookies onto a response. The token never leaves the server. */
export function applySessionCookies(response: NextResponse, payload: SessionPayload): void {
  const env = getEnv();
  const maxAge = maxAgeSeconds(payload);

  response.cookies.set({
    name: sessionCookieName(env.cookieSecure),
    value: sealSession(payload, env.sessionSecret),
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });

  // Readable by design: the client must be able to echo it in `X-CSRF-Token`.
  // Validation still happens against the secret inside the encrypted session.
  response.cookies.set({
    name: csrfCookieName(env.cookieSecure),
    value: payload.csrf,
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

/**
 * Deletes both cookies.
 *
 * Attributes must match the ones used when setting, otherwise browsers ignore the
 * deletion and the stale cookie survives.
 */
export function clearSessionCookies(response: NextResponse): void {
  const env = getEnv();

  response.cookies.set({
    name: sessionCookieName(env.cookieSecure),
    value: '',
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  response.cookies.set({
    name: csrfCookieName(env.cookieSecure),
    value: '',
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
