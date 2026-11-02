# StockFlow Lite — Web

Next.js (App Router) frontend for **StockFlow Lite**, an inventory / stock-request demo backed by a
Go + Fiber REST API and PostgreSQL.

The backend lives in a separate repository (`stock_flow_lite`) and is the single source of truth for
authorization, stock balances and audit records. This app never talks to PostgreSQL.

---

## Architecture in one paragraph

The browser never holds a backend token. It talks only to **Next.js Route Handlers** under
`/api/bff/*`, which forward authenticated requests to the Go API server-to-server. The opaque
backend bearer token lives inside an **encrypted `httpOnly` cookie** that JavaScript cannot read;
the BFF decrypts it per request, adds `Authorization: Bearer …` upstream, and returns the backend's
response envelope unchanged. `httpOnly` cookies introduce CSRF exposure, so every non-GET request
must carry an `X-CSRF-Token` header matching a secret stored inside the encrypted session, and the
`Origin` header must match `APP_ORIGIN`.

Consequences worth knowing:

- The frontend adds **no** business authorization. Roles and resource ownership are enforced by
  the API. UI gating is a usability feature, not a security control.
- No CORS configuration is required anywhere, because the browser never calls the API directly.
- `BACKEND_API_URL` and `SESSION_SECRET` are **server-only**. Never prefix them with `NEXT_PUBLIC_`
  — Next inlines `NEXT_PUBLIC_*` into the browser bundle at build time.

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/API-CONTRACT.md`](docs/API-CONTRACT.md).

---

## Prerequisites

- Node.js **20.9+** (developed on 20.18.0)
- The backend API running locally on `http://127.0.0.1:8080` with migrations applied and at least
  one `ADMIN` user bootstrapped — see the backend repo's `docs/API_TESTING.md`.

## Setup

```bash
npm install
copy .env.example .env.local     # then edit SESSION_SECRET
npm run dev                      # http://localhost:3000
```

Generate a real session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`.env.local` is gitignored. Keep `SESSION_COOKIE_SECURE=false` for local `http://` only; the app
refuses to boot in production with an insecure cookie.

> **Windows note:** prefer `.env.local` or PowerShell `$env:VAR="value"`. In `cmd.exe`,
> `set VAR=value & next` appends a trailing space to the value, which silently breaks secrets.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on port 3000 (pinned; the origin must match `APP_ORIGIN`) |
| `npm run build` | Production build — also catches server/client boundary violations |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:watch` | Vitest in watch mode |
| `npm run smoke:auth` | End-to-end BFF auth smoke test against a running server + API (needs `INT_USER` / `INT_PASS`) |
| `npm run smoke:workflow` | Two-account stock-request workflow test: approve → shortage → issue → idempotent replay → reject (needs `INT_USER`/`INT_PASS` and `INT_REVIEWER_USER`/`INT_REVIEWER_PASS`) |

## Project layout

```
src/
  app/            routes; (auth) and (app) groups; api/bff/* route handlers
  features/       one folder per domain: types, mappers, api, hooks, components
  lib/api/        envelope types, error normalisation, browser fetch wrapper
  lib/server/     server-only env, session crypto, CSRF, forwarding, logging
  lib/rbac/       capability matrix (mirrors the API, unit-tested)
  components/     shared presentational building blocks
tests/unit/       Vitest tests for the trust boundary
```

## Testing

| Command | What it covers | Requirements |
|---|---|---|
| `npm run typecheck` / `typecheck:tests` | Strict TypeScript on app code and on tests | — |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) | — |
| `npm test` | 215 unit tests: envelope, error normalisation, session crypto, CSRF, validation, RBAC matrix, navigation, mappings, rate limiting, date ranges | — |
| `npm run test:coverage` | Statement/branch/function coverage of the pure trust-boundary modules in `src/lib` | — |
| `npm run smoke:auth` | 54 HTTP checks through the BFF: cookie flags, no token leakage, CSRF, 401 handling, CRUD, receipts, requests, reports | Running server + API, `INT_USER`/`INT_PASS` |
| `npm run smoke:workflow` | 13 checks with **two** accounts: approve → shortage → issue → idempotent replay → reject | Running server + API, plus `INT_REVIEWER_USER`/`INT_REVIEWER_PASS` |
| `npm run test:e2e` | Playwright (Chromium) against the real stack: redirect flow, login/logout, httpOnly cookie, product CRUD, filters, navigation | Running API, `E2E_USER`/`E2E_PASS`; first run needs `npx playwright install chromium` |

`INT_ALLOW_WRITES=1` enables the data-mutating parts of `smoke:auth`.

> **Repeated runs and login throttling.** Both the BFF and the API keep their login
> limiters in memory. Running the suites several times in a row (especially E2E, which logs
> in per test) will eventually trip them and produce `429` failures that are *not* product
> bugs. Restart the API and the dev server before a full run.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| F0 | Foundation: scaffold, tooling, server-only env validation, test harness | ✅ done |
| F1 | BFF core: encrypted session cookie, CSRF, forwarding, auth routes | ✅ done |
| F2 | App shell, RBAC navigation, dashboard | ✅ done |
| F3 | Products (list / detail / create / edit / deactivate) | ✅ done |
| F4 | Stock receipts + movements ledger | ✅ done |
| F5 | Stock requests + approve / reject / cancel / issue (idempotent) | ✅ done |
| F6 | Reports (inventory / movements / requests) | ✅ done |
| F7 | Hardening: E2E suite, CSP, accessibility, docs | ✅ done |

