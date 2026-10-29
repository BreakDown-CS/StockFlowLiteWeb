'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { parseLimit, parseOffset } from '@/lib/validation/list-params';

import { REQUEST_STATUSES, type RequestStatus, type StockRequestQuery } from './types';

/**
 * Request list state lives in the URL.
 *
 * The API supports only `status` here, so no other filter is offered (dates belong to the
 * reports screens).
 */

export type RequestListParams = {
  status?: RequestStatus;
  limit: number;
  offset: number;
};

function parseStatus(raw: string | null): RequestStatus | undefined {
  return REQUEST_STATUSES.find((status) => status === raw);
}

export function useRequestListParams(): {
  params: RequestListParams;
  query: StockRequestQuery;
  update: (patch: Partial<RequestListParams>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<RequestListParams>(
    () => ({
      status: parseStatus(searchParams.get('status')),
      limit: parseLimit(searchParams.get('limit')),
      offset: parseOffset(searchParams.get('offset')),
    }),
    [searchParams],
  );

  const query = useMemo<StockRequestQuery>(
    () => ({ status: params.status, limit: params.limit, offset: params.offset }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<RequestListParams>) => {
      const merged = { ...params, ...patch };
      const next = new URLSearchParams(searchParams.toString());

      const filtersTouched = ('status' in patch) || ('limit' in patch);
      const offset = filtersTouched && !('offset' in patch) ? 0 : merged.offset;

      if (merged.status) {
        next.set('status', merged.status);
      } else {
        next.delete('status');
      }
      next.set('limit', String(merged.limit));
      next.set('offset', String(offset));

      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router, searchParams],
  );

  return { params, query, update };
}
