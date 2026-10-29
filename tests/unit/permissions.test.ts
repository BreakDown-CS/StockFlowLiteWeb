import { describe, expect, it } from 'vitest';

import {
  can,
  canAny,
  canIssueRequest,
  canReviewRequest,
  type Capability,
  type Role,
} from '@/lib/rbac/permissions';

/**
 * The expectations below are transcribed from docs/API-CONTRACT.md §3, which was
 * derived from the Go router. If the backend changes, this test must change too.
 */
const EXPECTED: Record<Capability, Record<Role, boolean>> = {
  'product:read': { REQUESTER: true, STOREKEEPER: true, ADMIN: true },
  'product:create': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'product:update': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'product:deactivate': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'receipt:create': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'movement:read': { REQUESTER: true, STOREKEEPER: true, ADMIN: true },
  'request:create': { REQUESTER: true, STOREKEEPER: true, ADMIN: true },
  'request:read:any': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'request:approve': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'request:reject': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'request:issue': { REQUESTER: false, STOREKEEPER: true, ADMIN: true },
  'request:cancel': { REQUESTER: true, STOREKEEPER: true, ADMIN: true },
  'report:read': { REQUESTER: true, STOREKEEPER: true, ADMIN: true },
  'integrity:read': { REQUESTER: false, STOREKEEPER: false, ADMIN: true },
  'user:manage': { REQUESTER: false, STOREKEEPER: false, ADMIN: true },
  'audit:read': { REQUESTER: false, STOREKEEPER: false, ADMIN: true },
};

const ROLES: Role[] = ['REQUESTER', 'STOREKEEPER', 'ADMIN'];

describe('capability matrix', () => {
  for (const capability of Object.keys(EXPECTED) as Capability[]) {
    for (const role of ROLES) {
      const expected = EXPECTED[capability][role];
      it(`${role} ${expected ? 'can' : 'cannot'} ${capability}`, () => {
        expect(can(role, capability)).toBe(expected);
      });
    }
  }
});

describe('canAny', () => {
  it('is true when at least one capability is held', () => {
    expect(canAny('REQUESTER', ['product:update', 'product:read'])).toBe(true);
  });

  it('is false when none are held', () => {
    expect(canAny('REQUESTER', ['product:update', 'receipt:create'])).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(canAny('ADMIN', [])).toBe(false);
  });
});

describe('four-eyes rule', () => {
  const ownRequest = { requesterId: 'user-1' };
  const otherRequest = { requesterId: 'user-2' };

  it('lets a storekeeper review someone else’s request', () => {
    expect(canReviewRequest('STOREKEEPER', otherRequest, 'user-1')).toBe(true);
  });

  it('blocks a storekeeper from reviewing their own request', () => {
    expect(canReviewRequest('STOREKEEPER', ownRequest, 'user-1')).toBe(false);
  });

  it('blocks an admin from reviewing their own request', () => {
    expect(canReviewRequest('ADMIN', ownRequest, 'user-1')).toBe(false);
  });

  it('never lets a requester review anything', () => {
    expect(canReviewRequest('REQUESTER', otherRequest, 'user-1')).toBe(false);
  });

  it('applies the same rule to issuance', () => {
    expect(canIssueRequest('STOREKEEPER', otherRequest, 'user-1')).toBe(true);
    expect(canIssueRequest('STOREKEEPER', ownRequest, 'user-1')).toBe(false);
    expect(canIssueRequest('REQUESTER', otherRequest, 'user-1')).toBe(false);
  });
});
