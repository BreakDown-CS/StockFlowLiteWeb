'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { parseIsActive, parseLimit, parseOffset } from '@/lib/validation/list-params';

import type { InventoryQuery } from './types';

/** Inventory report filter state (URL-canonical, like every other list). */

export type InventoryReportParams = {
  search: string;
  isActive: 'true' | 'false' | 'all';
  lowStock: boolean;
  limit: number;
  offset: number;
};

export function useInventoryReportParams(): {
  params: InventoryReportParams;
  query: InventoryQuery;
  update: (patch: Partial<InventoryReportParams>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<InventoryReportParams>(
    () => ({
      search: searchParams.get('search') ?? '',
      isActive: parseIsActive(searchParams.get('is_active')),
      lowStock: searchParams.get('low_stock') === 'true',
      limit: parseLimit(searchParams.get('limit')),
      offset: parseOffset(searchParams.get('offset')),
    }),
    [searchParams],
  );

  const query = useMemo<InventoryQuery>(
    () => ({
      search: params.search || undefined,
      isActive: params.isActive,
      lowStock: params.lowStock,
      limit: params.limit,
      offset: params.offset,
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<InventoryReportParams>) => {
      const merged = { ...params, ...patch };
      const next = new URLSearchParams(searchParams.toString());

      const filtersTouched = (
        ['search', 'isActive', 'lowStock', 'limit'] as const
      ).some((key) => key in patch);
      const offset = filtersTouched && !('offset' in patch) ? 0 : merged.offset;

      if (merged.search) {
        next.set('search', merged.search);
      } else {
        next.delete('search');
      }
      next.set('is_active', merged.isActive);
      if (merged.lowStock) {
        next.set('low_stock', 'true');
      } else {
        next.delete('low_stock');
      }
      next.set('limit', String(merged.limit));
      next.set('offset', String(offset));

      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router, searchParams],
  );

  return { params, query, update };
}
