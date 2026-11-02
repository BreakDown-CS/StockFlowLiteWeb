/**
 * TanStack Query key factory.
 *
 * Keys are built only here so that a mutation can invalidate precisely what it changed
 * (for example: issuing a request invalidates the request, the ledger, the reports and
 * the products, because stock moved everywhere).
 */
export const queryKeys = {
  session: () => ['auth', 'me'] as const,

  products: (query: Record<string, unknown>) => ['products', 'list', query] as const,
  product: (id: string) => ['products', 'detail', id] as const,

  movementReport: (query: Record<string, unknown>) => ['movements', 'report', query] as const,

  requests: (query: Record<string, unknown>) => ['requests', 'list', query] as const,
  request: (id: string) => ['requests', 'detail', id] as const,

  requestReport: (query: Record<string, unknown>) => ['reports', 'requests', query] as const,

  inventoryReport: (query: Record<string, unknown>) => ['reports', 'inventory', query] as const,
  lowStock: (limit: number) =>
    ['reports', 'inventory', { lowStock: true, limit, offset: 0 }] as const,
};

/** Coarse prefixes used to invalidate a whole domain after a mutation. */
export const queryPrefixes = {
  products: ['products'] as const,
  movements: ['movements'] as const,
  requests: ['requests'] as const,
  reports: ['reports'] as const,
};
