'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';

import { fetchProduct } from '@/features/products/api';
import type { Product } from '@/features/products/types';
import { queryKeys } from '@/lib/query/keys';

/** Upper bound on per-row lookups; beyond this the UI falls back to the raw id. */
const MAX_LOOKUPS = 20;

/**
 * Resolves product identity for ids that the API only references by id.
 *
 * Request line items carry just `product_id`, so the detail screen joins them against the
 * product endpoint. Results are cached per id by React Query, so paging or re-opening a
 * request costs nothing after the first time. Beyond `MAX_LOOKUPS` distinct products the
 * table shows the short id instead of firing an unbounded fan-out.
 */
export function useProductLookup(productIds: string[]): {
  byId: Map<string, Product>;
  isLoading: boolean;
  truncated: boolean;
} {
  // Join first so the query array is stable across renders.
  const key = productIds.join(',');
  const unique = useMemo(
    () => [...new Set(key.split(',').filter(Boolean))],
    [key],
  );
  const limited = unique.slice(0, MAX_LOOKUPS);

  const results = useQueries({
    queries: limited.map((id) => ({
      queryKey: queryKeys.product(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchProduct(id, signal),
      staleTime: 5 * 60_000,
      retry: 0,
    })),
  });

  const byId = new Map<string, Product>();
  for (const result of results) {
    if (result.data) {
      byId.set(result.data.id, result.data);
    }
  }

  return {
    byId,
    isLoading: results.some((result) => result.isLoading),
    truncated: unique.length > MAX_LOOKUPS,
  };
}
