import { NextResponse, type NextRequest } from 'next/server';

/**
 * Presence-only session gate (Next.js 16 `proxy` convention, formerly `middleware`).
 *
 * IMPORTANT: this does NOT validate the session. It runs on the Edge runtime, where the
 * Node `crypto` module used by the session cipher is unavailable, so it deliberately
 * does not pretend to be a security control. Its only job is a cheap redirect so an
 * unauthenticated visitor sees the login page instead of a flash of the app shell.
 *
 * The real control is per-request: every BFF route decrypts the cookie, the (app)
 * layout re-checks it on the server, and the API validates the token on every call.
 *
 * Both cookie names are checked because the `__Host-` prefix is only used when the
 * cookie is `Secure` (production). This file must not import the server-only env module,
 * which is unavailable at the edge.
 */

const SESSION_COOKIE_CANDIDATES = ['__Host-sf_session', 'sf_session'] as const;

const PUBLIC_PREFIXES = ['/login', '/_next', '/favicon.ico'] as const;

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const hasSessionCookie = SESSION_COOKIE_CANDIDATES.some((name) => request.cookies.has(name));
  if (hasSessionCookie || isPublic(pathname)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  // Preserve the destination so the user lands where they intended after signing in.
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Excludes API routes (they answer 401 themselves instead of redirecting) and static
   * assets.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
