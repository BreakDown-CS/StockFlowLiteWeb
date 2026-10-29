'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query/keys';

import { fetchMovementReport } from './api';
import type { MovementQuery } from './types';

/** Movement ledger query. `enabled` is false while the date range is inverted. */
export function useMovementReport(query: MovementQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.movementReport(query as Record<string, unknown>),
    queryFn: ({ signal }) => fetchMovementReport(query, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
