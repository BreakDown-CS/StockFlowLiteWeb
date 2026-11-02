import { can, type Capability, type Role } from './permissions';

/**
 * Sidebar navigation derived from the capability matrix.
 *
 * `available: false` marks a screen whose phase has not shipped yet. Those items are
 * rendered disabled rather than as dead links, so the demo never shows a 404 door while
 * still demonstrating the role matrix visually.
 */

export type NavItem = {
  key: string;
  href: string;
  label: string;
  /** Omitted for screens every authenticated user may open. */
  capability?: Capability;
  available: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', href: '/', label: 'Dashboard', available: true },
  {
    key: 'products',
    href: '/products',
    label: 'Products',
    capability: 'product:read',
    available: true,
  },
  {
    key: 'receive',
    href: '/stock-receipts/new',
    label: 'Receive stock',
    capability: 'receipt:create',
    available: true,
  },
  {
    key: 'requests',
    href: '/stock-requests',
    label: 'Stock requests',
    capability: 'request:create',
    available: true,
  },
  {
    key: 'movements',
    href: '/stock-movements',
    label: 'Movements',
    capability: 'movement:read',
    available: true,
  },
  {
    key: 'report-inventory',
    href: '/reports/inventory',
    label: 'Inventory report',
    capability: 'report:read',
    available: true,
  },
  {
    key: 'report-movements',
    href: '/reports/movements',
    label: 'Movement report',
    capability: 'report:read',
    available: true,
  },
  {
    key: 'report-requests',
    href: '/reports/requests',
    label: 'Request report',
    capability: 'report:read',
    available: true,
  },
];

/** Items the given role may see at all (regardless of phase availability). */
export function visibleNav(role: Role, items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((item) => item.capability === undefined || can(role, item.capability));
}

/** Marks the current item. `/` matches exactly; deeper hrefs match by prefix. */
export function isActivePath(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
