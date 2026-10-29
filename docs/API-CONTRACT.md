# API contract (verified)

Every statement here was checked against the **backend source** in `stock_flow_lite`
(Go + Fiber). The backend is the source of truth: if this document and the code
disagree, the code wins and this file must be corrected.

The frontend never adds business authorization. It mirrors the contract; it does not
extend it.

---

## 1. Envelope

```json
{ "success": true,  "message": "…", "data": {}, "meta": { "limit": 20, "offset": 0, "total": 42 } }
{ "success": false, "error": { "code": "FORBIDDEN", "message": "…", "details": {} } }
```

- `meta` only appears on list endpoints; `total` is a **64-bit** integer.
- `/health` and `/ready` are **not** enveloped (`{status, service}` / `{status, database}`).
- Reports return `data = { "summary": {…}, "items": [ … ] }`.
- Source: `pkg/response/response.go`.

## 2. Authentication

- `Authorization: Bearer <opaque token>`.
- The token is issued **only** by `POST /api/v1/auth/login`, as
  `data = { token, token_type: "Bearer", expires_at, user }`.
- Default TTL **12h** (`AUTH_TOKEN_TTL`). **There is no refresh endpoint** — sessions cannot be
  extended; `expires_at` is a hard deadline.
- `POST /auth/logout` revokes the current session. `POST /auth/change-password` revokes **all**
  sessions of that user. A deactivated account fails authentication immediately.
- Any invalid / expired / revoked token, or inactive user, returns **401 `UNAUTHORIZED`** — the
  frontend cannot distinguish the cause and must treat all of them as "sign in again".
- Sources: `router.go`, `middleware/auth.go`, `usecase/auth/auth_usecase.go`.

## 3. Role matrix

| Endpoint group | REQUESTER | STOREKEEPER | ADMIN |
|---|---|---|---|
| `POST /auth/login`, `/health`, `/ready` | public | public | public |
| `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` | ✅ | ✅ | ✅ |
| `GET /products`, `GET /products/:id`, `GET /stock-movements` | ✅ | ✅ | ✅ |
| `POST/PUT /products`, `PATCH /products/:id/deactivate`, `POST /stock-receipts` | ❌ 403 | ✅ | ✅ |
| `POST /stock-requests`, `GET /stock-requests*` | ✅ own only | ✅ | ✅ |
| `POST /stock-requests/:id/{approve,reject,issue}` | ❌ 403 | ✅ | ✅ |
| `POST /stock-requests/:id/cancel` | ✅ own only | ✅ | ✅ |
| `/users/*`, `/audit-events`, `/reports/integrity/stock` | ❌ 403 | ❌ 403 | ✅ |
| `/reports/{inventory,stock-movements,stock-requests}` | ✅ | ✅ | ✅ |

**Four-eyes rule:** a user who is the *requester* of a request may never `approve`, `reject` or
`issue` it, regardless of role → `403 SELF_APPROVAL_FORBIDDEN`. Enforced inside the DB transaction
(`stock_request_repo.go`).

**Requester scoping is server-side:** the request list is auto-filtered to the actor's own rows,
and `GET /stock-requests/:id` for someone else's request returns **404** (not 403), so the frontend
must not offer a requester filter as if it were a permission control.

## 4. Pagination

- `limit` / `offset` only. **No cursor. No sort parameters on any endpoint.**

## 5. Filters and date ranges

| Endpoint | Supported query parameters |
|---|---|
| `GET /products` | `limit`, `offset`, `search`, `is_active` (`true`/`false`/`all`) |
| `GET /stock-movements` | `limit`, `offset`, `product_id`, `movement_type`, `from`, `to` |
| `GET /stock-requests` | `limit`, `offset`, **`status` only** — no dates, no search |
| `GET /reports/inventory` | `search`, `is_active`, `low_stock`, `limit`, `offset` |
| `GET /reports/stock-movements` | `product_id`, `movement_type`, `from`, `to`, `limit`, `offset` |
| `GET /reports/stock-requests` | `status`, `requester_id`, `from`, `to`, `limit`, `offset` |

- `from` / `to` are **RFC3339** timestamps, parsed to UTC. There is **no default range**: omitting
  them scans the whole table. `from > to` → `400 INVALID_PARAMETER`.
- JavaScript `toISOString()` (with milliseconds and `Z`) is accepted: Go's `time.Parse` tolerates a
  fractional second even when the layout omits it.

## 6. Idempotency

- **Only** `POST /stock-requests/:id/issue` honours `Idempotency-Key`.
- Optional; when present it must be **8–100 characters** of `A-Za-z0-9._:-`.
- A replay returns `200` with `meta.idempotent_replay: true` (not an error).
- `409 IDEMPOTENCY_KEY_REUSED` when the key was already used for a *different* request.
- Sending the header to any other endpoint has **no effect** — do not pretend otherwise in the UI;
  guard double submits with disabled buttons instead.

## 7. Workflow

```
PENDING ──approve──▶ APPROVED ──issue──▶ ISSUED
   │                    │
   ├──reject──▶ REJECTED│
   └──cancel──▶ CANCELLED ◀──cancel──┘
```

- `issue` deducts **every** item atomically. If any item is short, nothing is deducted and the API
  returns `409 INSUFFICIENT_STOCK` with
  `error.details.items = [{product_id, requested, available, shortfall}]`.
- Invalid transitions return `409 INVALID_STATE` with `error.details.current_status`.
- There is **no** product "activate" and **no** delete endpoint for products or requests.

## 8. Error codes the UI must handle explicitly

`BAD_REQUEST`, `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_PARAMETER`, `INVALID_IDEMPOTENCY_KEY`,
`INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `UNAUTHORIZED`, `FORBIDDEN`, `SELF_APPROVAL_FORBIDDEN`,
`NOT_FOUND`, `DUPLICATE_SKU`, `DUPLICATE_ITEM`, `DUPLICATE_REQUEST_NUMBER`, `PRODUCT_INACTIVE`,
`IDEMPOTENCY_KEY_REUSED`, `INSUFFICIENT_STOCK`, `INVALID_STATE`, `STOCK_OVERFLOW`, `INTERNAL_ERROR`.

Notes:

- `429 TOO_MANY_ATTEMPTS` carries **no `Retry-After` header**; the UI cannot show a countdown.
- `INTERNAL_ERROR` messages are already generic; the frontend must not add detail from its own logs
  to the user-facing copy.

## 9. Known gaps (backend, not fixable from this repo)

1. **No CORS headers at all** and **no `ProxyHeader` / trusted-proxy configuration**. Browser-direct
   calls are impossible (hence the BFF), and upstream audit records will show the BFF's IP and the
   forwarded `User-Agent`, not the end user's address.
2. **Login throttling is in-memory**, keyed by `username|IP`. Through the BFF every request shares
   one IP, so per-username lockout is globally reachable. The BFF adds its own limiter; the proper
   fix needs a backend change.
3. **No sort parameters** — the UI must not offer column sorting that implies server-side ordering.
4. **No reactivate / delete** — demo and E2E data accumulate and need manual SQL cleanup.

- Default `limit` 20, maximum 100 (the API clamps silently).
- ⚠️ `GET /products` does **not** clamp `limit` before echoing it in `meta`, so a request with
  `limit > 100` reports a `meta.limit` larger than the rows returned. **Always request ≤ 100.**
- Offset pagination means rows can shift between pages while data changes; refresh before
  trusting page N after a mutation.
