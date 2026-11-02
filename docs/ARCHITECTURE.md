# Architecture

## 1. Shape

```
┌──────────────┐   same origin, httpOnly cookie    ┌────────────────────┐   Bearer token   ┌─────────────┐
│   Browser    │ ────────────────────────────────▶ │  Next.js BFF       │ ───────────────▶ │  Go API     │
│  (React/antd)│ ◀──────────────────────────────── │  app/api/bff/*     │ ◀─────────────── │  (Fiber)    │
└──────────────┘        envelope JSON              └────────────────────┘                  └──────┬──────┘
                                                          │ secrets only here                    │
                                                          ▼                                      ▼
                                                   SESSION_SECRET                            PostgreSQL
```

The browser never holds a token and never calls the API directly. The BFF is the only place
where secrets exist, and the only place that can reach the backend.

**Why a BFF instead of calling the API from the browser**

1. The API sends **no CORS headers** (verified) and no trusted-proxy configuration, so a
   browser-direct call is impossible without a backend change.
2. An `httpOnly` cookie keeps the token out of JavaScript, which is the strongest practical
   answer to XSS token theft in a cookie-only design.
3. Input validation, error normalisation and request correlation live in one layer.

## 2. Request lifecycle (authenticated read)

```
Browser  GET /api/bff/products?limit=20&offset=0        (cookie sent automatically)
  │
  ├─ route: validate query with zod (allowlist + bounds)
  ├─ session: read cookie → decrypt (AES-256-GCM) → check exp → token in memory
  ├─ upstream: GET {BACKEND_API_URL}/api/v1/products?limit=20&offset=0
  │            headers: Authorization: Bearer …, Accept, User-Agent, X-Request-ID
  │            cache: no-store, redirect: manual, AbortSignal timeout
  ├─ response: content-type sniff → JSON envelope passed through unchanged
  │            non-JSON (plain text / HTML) → synthesised envelope
  └─ reply: same status + envelope, Cache-Control: no-store, x-bff-request-id
```

A mutation adds two steps before the upstream call: **Origin allowlist** and
**`X-CSRF-Token` compared to the secret stored inside the encrypted session**.

## 3. Layers

| Layer | Location | Rule |
|---|---|---|
| Routes / pages | `src/app/**` | Server Components by default; no business logic |
| Feature modules | `src/features/<domain>/**` | Own DTO → view-model mappers, API calls, hooks, components |
| Browser API client | `src/lib/api/bff-client.ts` | The only client-side `fetch` to `/api/bff/*` |
| Server boundary | `src/lib/server/**` | The only code that holds secrets or talks to the API |
| Validation | `src/lib/validation/**` | zod schemas for query strings and request bodies |
| RBAC | `src/lib/rbac/permissions.ts` | Pure capability matrix, mirrors the API matrix |
| Shared UI | `src/components/**` | Presentational only |

## 4. Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Session storage | Encrypted `httpOnly` cookie holding the backend token | No infra required; upgradeable to a server-side store by changing one module |
| Response shape | Backend envelope returned **verbatim** | One parser on the client; the frontend contract equals the backend contract |
| Proxy surface | One explicit route file per resource | The reachable upstream surface is auditable; no accidental open proxy |
| Data fetching | TanStack Query on the client; RSC for the shell and the auth gate | Tables are interactive; one fetch layer keeps error handling consistent |
| Types | `snake_case` DTOs + pure mappers to `camelCase` view models | A contract change is a one-file diff; UI code stays idiomatic |
| Enums | String literal unions with `as const` arrays | Reusable directly as Ant Design `Select` options |
| Sorting | **None** | The API has no sort parameters; a client sorter would only reorder one page |
| Pagination | Offset-based, URL as the source of truth | Matches the API; refresh- and share-safe |

## 5. Phase map

| Phase | Deliverable | Status |
|---|---|---|
| F0 | Scaffold, tooling, server-only env validation, test harness | ✅ |
| F1 | Session cookie, CSRF, forwarding helper, auth routes | ✅ |
| F2 | App shell, RBAC navigation, dashboard | ✅ |
| F3 | Products | ✅ |
| F4 | Stock receipts + movements | ✅ |
| F5 | Stock requests + workflow (idempotent issue) | ✅ |
| F6 | Reports (+ optional change password) | ✅ |
| F7 | E2E suite, CSP, accessibility, docs polish | ✅ |

See `docs/SECURITY.md` for the threat model and `docs/API-CONTRACT.md` for the verified
backend contract.
