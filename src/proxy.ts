import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (Next.js 16's `middleware`): session presence gate + Content-Security-Policy.
 *
 * TWO separate jobs, on purpose:
 *
 * 1. **Presence gate** — a cheap redirect for unauthenticated visitors. This is NOT a
 *    security control: it runs on the Edge runtime, cannot decrypt the session, and can be
 *    fooled by a stale cookie. Every BFF route still decrypts the cookie, the (app) layout
 *    re-checks it on the server, and the API validates the token on every call.
 *
 * 2. **CSP** — a fresh nonce per document request. Next.js reads the nonce from this
 *    header and stamps its own scripts with it; `strict-dynamic` then allows the chunks
 *    those scripts load. `style-src` still needs `'unsafe-inline'` because Ant Design
 *    injects its styles at runtime (CSS-in-JS) — a documented, deliberate trade-off.
 */

const SESSION_COOKIE_CANDIDATES = ['__Host-sf_session', 'sf_session'] as const;

const PUBLIC_PREFIXES = ['/login', '/_next', '/favicon.ico'] as const;

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** 128-bit random nonce, base64 — `crypto.getRandomValues` exists on the Edge runtime. */
function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // Ant Design injects <style> tags at runtime; a nonce cannot cover that.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next.js looks for the nonce in the request's CSP header and applies it to its scripts.
  requestHeaders.set('Content-Security-Policy', csp);

  function withCsp(response: NextResponse): NextResponse {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  const hasSessionCookie = SESSION_COOKIE_CANDIDATES.some((name) => request.cookies.has(name));
  if (hasSessionCookie || isPublic(pathname)) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  const loginUrl = new URL('/login', request.url);
  // Preserve the destination so the user lands where they intended after signing in.
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return withCsp(NextResponse.redirect(loginUrl));
}

export const config = {
  /**
   * Excludes API routes (they answer 401 themselves instead of redirecting, and JSON does
   * not need a document CSP) and static assets.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
