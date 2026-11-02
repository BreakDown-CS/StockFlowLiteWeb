'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { REQUEST_STATUSES, type RequestStatus } from '@/features/stock-requests/types';
import { parseLimit, parseOffset } from '@/lib/validation/list-params';
import { resolveReportRange, type ReportRange } from '@/lib/validation/report-range';

import type { RequestReportQuery } from './types';

/**
 * Request report filter state.
 *
 * The date range defaults to the last 30 days (the API has no default of its own and would
 * otherwise scan everything). `range=all` is the explicit escape hatch, so the default can
 * never hide history silently.
 */

export type RequestReportParams = {
  status?: RequestStatus;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

export type RequestReportState = {
  params: RequestReportParams;
  range: ReportRange;
  query: RequestReportQuery;
  update: (patch: Partial<RequestReportParams>) => void;
  clearRange: () => void;
  useLast30Days: () => void;
};

function parseStatus(raw: string | null): RequestStatus | undefined {
  return REQUEST_STATUSES.find((status) => status === raw);
}

export function useRequestReportParams(): RequestReportState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<RequestReportParams>(
    () => ({
      status: parseStatus(searchParams.get('status')),
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      limit: parseLimit(searchParams.get('limit')),
      offset: parseOffset(searchParams.get('offset')),
    }),
    [searchParams],
  );

  const range = useMemo(
    () =>
      resolveReportRange({
        from: params.from,
        to: params.to,
        range: searchParams.get('range'),
      }),
    [params.from, params.to, searchParams],
  );

  const query = useMemo<RequestReportQuery>(
    () => ({
      status: params.status,
      from: range.from,
      to: range.to,
      limit: params.limit,
      offset: params.offset,
    }),
    [params.status, params.limit, params.offset, range],
  );

  const update = useCallback(
    (patch: Partial<RequestReportParams>) => {
      const merged = { ...params, ...patch };
      const next = new URLSearchParams(searchParams.toString());

      const filtersTouched = (
        ['status', 'from', 'to', 'limit'] as const
      ).some((key) => key in patch);
      const offset = filtersTouched && !('offset' in patch) ? 0 : merged.offset;

      if (merged.status) {
        next.set('status', merged.status);
      } else {
        next.delete('status');
      }
      if (merged.from && merged.to) {
        next.set('from', merged.from);
        next.set('to', merged.to);
        next.delete('range');
      } else {
        next.delete('from');
        next.delete('to');
      }
      next.set('limit', String(merged.limit));
      next.set('offset', String(offset));

      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router, searchParams],
  );

  const clearRange = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('from');
    next.delete('to');
    next.set('range', 'all');
    next.set('offset', '0');
    router.replace(`${pathname}?${next.toString()}`);
  }, [pathname, router, searchParams]);

  const useLast30Days = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('from');
    next.delete('to');
    next.delete('range');
    next.set('offset', '0');
    router.replace(`${pathname}?${next.toString()}`);
  }, [pathname, router, searchParams]);

  return { params, range, query, update, clearRange, useLast30Days };
}
