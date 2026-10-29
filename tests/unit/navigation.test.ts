import { describe, expect, it } from 'vitest';

import { isActivePath, NAV_ITEMS, visibleNav } from '@/lib/rbac/navigation';

describe('visibleNav', () => {
  const labels = (role: Parameters<typeof visibleNav>[0]) =>
    visibleNav(role).map((item) => item.label);

  it('hides "Receive stock" from a requester', () => {
    expect(labels('REQUESTER')).not.toContain('Receive stock');
  });

  it('shows "Receive stock" to a storekeeper and an admin', () => {
    expect(labels('STOREKEEPER')).toContain('Receive stock');
    expect(labels('ADMIN')).toContain('Receive stock');
  });

  it('shows every report to every role', () => {
    for (const role of ['REQUESTER', 'STOREKEEPER', 'ADMIN'] as const) {
      expect(labels(role)).toEqual(
        expect.arrayContaining(['Inventory report', 'Movement report', 'Request report']),
      );
    }
  });

  it('keeps the dashboard for everyone', () => {
    for (const role of ['REQUESTER', 'STOREKEEPER', 'ADMIN'] as const) {
      expect(labels(role)[0]).toBe('Dashboard');
    }
  });

  it('shows more items to an admin than to a requester', () => {
    expect(visibleNav('ADMIN').length).toBeGreaterThanOrEqual(visibleNav('REQUESTER').length);
  });

  it('preserves declaration order', () => {
    const visible = visibleNav('STOREKEEPER');
    const order = visible.map((item) =>
      NAV_ITEMS.findIndex((candidate) => candidate.key === item.key),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('isActivePath', () => {
  it('matches the dashboard only exactly', () => {
    expect(isActivePath('/', '/')).toBe(true);
    expect(isActivePath('/', '/products')).toBe(false);
  });

  it('matches nested routes by prefix', () => {
    expect(isActivePath('/products', '/products')).toBe(true);
    expect(isActivePath('/products', '/products/123')).toBe(true);
    expect(isActivePath('/products', '/products/123/edit')).toBe(true);
  });

  it('does not match a sibling route with a shared prefix', () => {
    expect(isActivePath('/products', '/products-archive')).toBe(false);
  });
});
