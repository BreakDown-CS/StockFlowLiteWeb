/**
 * Role → capability matrix.
 *
 * This file is a UI convenience ONLY. The API is the source of truth for
 * authorization (see docs/API-CONTRACT.md §3); every action still reaches the backend,
 * and a 403 is always rendered as a real error state. What this module buys us is that
 * the UI never *offers* an action the API will certainly reject.
 *
 * The matrix is unit-tested against the documented table, so drift shows up as a
 * failing test rather than as a confusing 403 in the demo.
 */

export const ROLES = ['REQUESTER', 'STOREKEEPER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = [
  'product:read',
  'product:create',
  'product:update',
  'product:deactivate',
  'receipt:create',
  'movement:read',
  'request:create',
  'request:read:any',
  'request:approve',
  'request:reject',
  'request:issue',
  'request:cancel',
  'report:read',
  'integrity:read',
  'user:manage',
  'audit:read',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL_ROLES: readonly Role[] = ['REQUESTER', 'STOREKEEPER', 'ADMIN'];
const STOREKEEPER_AND_ADMIN: readonly Role[] = ['STOREKEEPER', 'ADMIN'];
const ADMIN_ONLY: readonly Role[] = ['ADMIN'];

/** Mirrors the backend router and use-case rules exactly. */
const MATRIX: Record<Capability, readonly Role[]> = {
  // Everyone authenticated may read products and the movement ledger.
  'product:read': ALL_ROLES,
  'movement:read': ALL_ROLES,

  // Writes are storekeeper/admin (router.go: POST/PUT/PATCH /products, POST /stock-receipts).
  'product:create': STOREKEEPER_AND_ADMIN,
  'product:update': STOREKEEPER_AND_ADMIN,
  'product:deactivate': STOREKEEPER_AND_ADMIN,
  'receipt:create': STOREKEEPER_AND_ADMIN,

  // Requesters may create requests; everyone may read their visible subset.
  'request:create': ALL_ROLES,
  // Storekeepers/admins see every request; a requester is scoped server-side to their own.
  'request:read:any': STOREKEEPER_AND_ADMIN,

  // Review and issuance are storekeeper/admin, and blocked for the request's own author.
  'request:approve': STOREKEEPER_AND_ADMIN,
  'request:reject': STOREKEEPER_AND_ADMIN,
  'request:issue': STOREKEEPER_AND_ADMIN,

  // Anyone may cancel — server-side a requester is limited to their own requests.
  'request:cancel': ALL_ROLES,

  'report:read': ALL_ROLES,
  'integrity:read': ADMIN_ONLY,
  'user:manage': ADMIN_ONLY,
  'audit:read': ADMIN_ONLY,
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[capability].includes(role);
}

export function canAny(role: Role, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => can(role, capability));
}

/**
 * The four-eyes rule: the author of a request may never approve, reject or issue it,
 * whatever their role. Enforced by the API inside the DB transaction; mirrored here so
 * the UI can hide the buttons instead of offering a guaranteed 403.
 */
export function canReviewRequest(
  role: Role,
  request: { requesterId: string },
  viewerUserId: string,
): boolean {
  if (request.requesterId === viewerUserId) {
    return false;
  }
  return can(role, 'request:approve') || can(role, 'request:reject');
}

export function canIssueRequest(
  role: Role,
  request: { requesterId: string },
  viewerUserId: string,
): boolean {
  if (request.requesterId === viewerUserId) {
    return false;
  }
  return can(role, 'request:issue');
}
