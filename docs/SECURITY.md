# Security design

This document states what the frontend protects, against whom, and — just as importantly —
what it does **not** protect. It is written for reviewers, not for marketing.

Scope: the Next.js BFF in this repository. The Go API remains the source of truth for
authentication, roles, resource ownership and audit. **The frontend never adds or relaxes
authorization.**

---

## 1. Assets

| Asset | Where it lives | Why it matters |
|---|---|---|
| Opaque backend bearer token | Encrypted `httpOnly` cookie, and in memory for the duration of one forwarded request | Full API access as the user until it expires or is revoked |
| Inventory / request data | Backend PostgreSQL, rendered here | Business integrity and privacy |
| Audit attribution | Backend `audit_events` | Detecting "who did what" depends on correct identity |

## 2. Trust boundaries

```
browser  ──(same origin, httpOnly cookie)──▶  Next.js BFF  ──(Bearer token)──▶  Go API
   ↑ untrusted input                            ↑ the only place secrets exist      ↑ authority
```

- Everything arriving at a Route Handler is **untrusted input** and is validated with zod before use.
- The browser never receives the token, in any response body or header.

## 3. Cookie settings

| Cookie | Flags | Contents |
|---|---|---|
| `__Host-sf_session` (prod) / `sf_session` (dev) | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age = expires_at − now` | AES-256-GCM ciphertext of `{v, token, exp, csrf, user}` |
| `__Host-sf_csrf` (prod) / `sf_csrf` (dev) | `Secure; SameSite=Lax; Path=/` (readable by JS **by design**) | The same CSRF secret, so the client can echo it in a header |

- Key material comes from `SESSION_SECRET` (≥32 chars). Each cookie gets a fresh 12-byte IV; the
  GCM authentication tag is verified by `decipher.final()`, so tampering fails closed.
- `exp` is copied from the backend's `expires_at` and **never extended**. There is no refresh
  endpoint, so the browser cannot stretch a session.
- `Secure` is forced when `NODE_ENV=production`; the app refuses to boot with
  `SESSION_COOKIE_SECURE=false` in production.
- `__Host-` is used in production, which prevents a sibling subdomain from shadowing the cookie.
  On plain-HTTP localhost the prefix is dropped (browsers reject `Secure`/`__Host-` on some
  dev setups); that deviation is dev-only and enforced by the boot check above.

## 4. Threat model and controls

| Threat | Control | Residual risk |
|---|---|---|
| **XSS reads the token** | Token lives in an `httpOnly` cookie — unreachable from JavaScript. React escaping; no `dangerouslySetInnerHTML`; lint gate enforces both | XSS can still *act* as the user. Inherent to cookie auth; mitigated by CSP in Phase F7 |
| **Token leaked in a bundle** | Only `NEXT_PUBLIC_APP_NAME` is public. `lib/server/env.ts` starts with `import 'server-only'`, so a client import is a build error | — |
| **Token leaked in logs** | Structured logger redacts `authorization`, `cookie`, `set-cookie`, `password`; the login route never logs the body | — |
| **Network interception** | `Secure` cookie + TLS at the host | Loopback HTTP in local dev (accepted) |
| **CSRF on a mutation** | (1) every mutation is non-GET; (2) `SameSite=Lax`; (3) session-bound double submit — the header must equal the secret stored *inside* the encrypted session, so a planted cookie is useless; (4) `Origin`/`Referer` allowlist against `APP_ORIGIN`; (5) JSON-only bodies — a cross-origin HTML form cannot send `Content-Type: application/json` without a preflight | Same-site subdomain attacker (blocked by `__Host-`); XSS (see above) |
| **Login CSRF / session fixation** | `Origin` allowlist enforced on `POST /api/bff/auth/login`; the backend always mints a brand-new session | — |
| **Open proxy / SSRF through the BFF** | The BFF accepts no URL and no path from the client: route segments are validated (UUID / enum allowlists) and mapped to fixed upstream paths; query keys are allowlisted | — |
| **Cache poisoning of authenticated responses** | Every BFF response sets `Cache-Control: no-store` | — |
| **Credential stuffing** | Backend limiter (8 attempts / 15 min per username+IP) plus a BFF-side limiter per client IP and per username | Both limiters are in-memory → per instance. See §6 |
| **Privilege escalation via the UI** | UI gating is cosmetic. Every action is enforced by the API; a `403` is rendered as a real error state, never swallowed | — |
| **Replay after logout** | Logout calls the API first (a real server-side revocation), then deletes the cookie | If that call fails, the token stays valid until its TTL. Cookies are still cleared locally and the failure is logged |

## 5. What this design does NOT protect against

Stated plainly, because a security section that only lists wins is not a security section.

1. **A compromised browser.** Malware or a hostile extension that can drive the page can perform
   any action the user can. `httpOnly` protects the *token*, not the *session*.
2. **Server-side compromise.** Whoever holds `SESSION_SECRET` can mint valid cookies. Rotating that
   secret invalidates every session, which is the intended emergency lever.
3. **No BFF-side session store.** There is no server-side record of "which sessions exist" at the
   BFF, so there is no instant global sign-out from the frontend. Revocation is still real because
   the *backend* owns it: logout, password change and deactivation take effect on the very next
   upstream call. Adding a store (Redis/Postgres) would strengthen this and is the documented
   upgrade path — it only touches `lib/server/session.ts`.
4. **No refresh token.** A session lives at most `AUTH_TOKEN_TTL` (12h default) and cannot be
   extended. Users are signed out mid-work; unsaved form input is lost.
5. **Audit IP attribution.** All upstream requests originate from the BFF, so the backend records the
   BFF's address rather than the end user's. Fixing this needs backend trusted-proxy configuration
   (`ProxyHeader`) — a backend change, deliberately out of scope.
6. **Brute-force limiter is per-instance.** Both the backend limiter and the BFF limiter are
   in-memory. Horizontally scaled deployments get N independent budgets. Also, because the BFF
   fronts every login, the backend's `username|IP` key degenerates to a single key per username,
   which makes username-level lockout reachable by an attacker. The BFF limiter per client IP is
   the compensating control.
7. **`style-src` still allows inline styles.** The CSP ships a per-request nonce for scripts
   (`script-src 'self' 'nonce-…' 'strict-dynamic'`), but Ant Design injects `<style>` tags at
   runtime, so `style-src` needs `'unsafe-inline'`. That means CSS injection is still possible;
   it cannot execute script, and `script-src` remains nonce-bound. A nonce for styles would
   require threading it through `@ant-design/cssinjs`, which is not wired up yet.
8. **No XSS-hunting beyond CSP.** Baseline headers (`nosniff`, `X-Frame-Options: DENY`,
   `Referrer-Policy: no-referrer`, `Permissions-Policy`, `COOP`) are set in `next.config.ts`,
   and the CSP in `src/proxy.ts`.

## 6. Deployment constraints

- The BFF and the browser must share an **origin**. `APP_ORIGIN` must equal the real public origin,
  otherwise the CSRF origin check rejects every mutation.
- `BACKEND_API_URL` should stay on a private network; it is never exposed to the client.
- TLS must be terminated in front of the app, and `NODE_ENV=production` must be set, or the boot
  check refuses to start with an insecure cookie.
- On serverless platforms, in-memory limiters reset per instance (see §5.6). The design still works;
  the throttling strength drops.
- Pin the dev port to 3000. If Next picks another port, `APP_ORIGIN` no longer matches and every
  mutation fails the origin check.

## 7. Review checklist

Every item below is executable: run `npm run smoke:auth` (see `scripts/smoke-auth.mjs`)
against a running server with `INT_USER` / `INT_PASS` set. It asserts the whole
authentication contract — cookie flags, no token in any response body, CSRF rejection,
and real upstream revocation on logout — and exits non-zero on any failure.

- [ ] `SESSION_SECRET` is ≥32 chars, generated randomly, and differs per environment.
- [ ] No `NEXT_PUBLIC_` prefix on `BACKEND_API_URL`, `SESSION_SECRET` or `APP_ORIGIN`.
- [ ] A client component importing `lib/server/env.ts` fails the build.
- [ ] Session cookie shows `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- [ ] A mutation without `X-CSRF-Token` returns 403.
- [ ] A mutation with a forged `Origin` returns 403.
- [ ] Any upstream 401 clears the cookie and redirects once (no redirect loop).
- [ ] Logs contain no `authorization`, `cookie`, `set-cookie` or `password` values.
- [ ] A requester never sees another requester's request (server-enforced; verify 404).
- [ ] A requester cannot approve/issue their own request (four-eyes, 403 from the API).

