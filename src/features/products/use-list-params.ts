'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  parseIsActive,
  parseLimit,
  parseOffset,
  type IsActiveFilter,
} from '@/lib/validation/list-params';

import type { ProductQuery } from './types';

/**
 * Product list state lives in the URL.
 *
 * Refresh, back/forward and shared links all restore the same view, and there is a
 * single source of truth to keep in sync. Values are clamped to what the API supports
 * (limit ≤ 100) before they are used or written back.
 */

export type ProductListParams = {
  search: string;
  isActive: IsActiveFilter;
  limit: number;
  offset: number;
};

export function useProductListParams(): {
  params: ProductListParams;
  query: ProductQuery;
  update: (patch: Partial<ProductListParams>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<ProductListParams>(
    () => ({
      search: searchParams.get('search') ?? '',
      isActive: parseIsActive(searchParams.get('is_active')),
      limit: parseLimit(searchParams.get('limit')),
      offset: parseOffset(searchParams.get('offset')),
    }),
    [searchParams],
  );

  const query = useMemo<ProductQuery>(
    () => ({
      search: params.search || undefined,
      isActive: params.isActive,
      limit: params.limit,
      offset: params.offset,
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<ProductListParams>) => {
      const merged = { ...params, ...patch };
      const next = new URLSearchParams(searchParams.toString());

      // Any filter or page-size change returns to the first page: page N of a different
      // result set would be meaningless.
      const resetOffset =
        patch.search !== undefined || patch.isActive !== undefined || patch.limit !== undefined;
      const offset = resetOffset ? 0 : merged.offset;

      next.set('limit', String(merged.limit));
      next.set('offset', String(offset));
      next.set('is_active', merged.isActive);

      if (merged.search) {
        next.set('search', merged.search);
      } else {
        next.delete('search');
      }

      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router, searchParams],
  );

  return { params, query, update };
}
