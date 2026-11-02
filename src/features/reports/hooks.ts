'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';

import { fetchInventoryReport, fetchRequestReport } from './api';
import type { InventoryQuery, RequestReportQuery } from './types';

/**
 * Inventory report query.
 *
 * `keepPreviousData` keeps the previous page on screen while the next one loads, which
 * avoids a layout jump when paging an offset-paginated list.
 */
export function useInventoryReport(
  query: InventoryQuery = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.inventoryReport(query as Record<string, unknown>),
    queryFn: ({ signal }) => fetchInventoryReport(query, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useRequestReport(query: RequestReportQuery = {}) {
  return useQuery({
    queryKey: queryKeys.requestReport(query as Record<string, unknown>),
    queryFn: ({ signal }) => fetchRequestReport(query, signal),
    placeholderData: keepPreviousData,
  });
}
