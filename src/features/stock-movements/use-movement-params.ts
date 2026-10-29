'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { parseLimit, parseOffset } from '@/lib/validation/list-params';

import { MOVEMENT_TYPES, type MovementQuery, type MovementType } from './types';

/**
 * Ledger filter state lives in the URL, like the product list.
 *
 * `from` / `to` are stored as absolute RFC3339 instants: the API compares timestamps and
 * knows nothing about time zones, so the conversion from a local day happens here once.
 */

export type MovementListParams = {
  productId?: string;
  movementType?: MovementType;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

function parseMovementType(raw: string | null): MovementType | undefined {
  return MOVEMENT_TYPES.find((type) => type === raw);
}

function parseInstant(raw: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }
  return Number.isNaN(Date.parse(raw)) ? undefined : raw;
}

function setOrDelete(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export function useMovementListParams(): {
  params: MovementListParams;
  query: MovementQuery;
  /** True when the URL carries `from > to`; the query is then not executed. */
  rangeInvalid: boolean;
  update: (patch: Partial<MovementListParams>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<MovementListParams>(
    () => ({
      productId: searchParams.get('product_id') ?? undefined,
      movementType: parseMovementType(searchParams.get('movement_type')),
      from: parseInstant(searchParams.get('from')),
      to: parseInstant(searchParams.get('to')),
      limit: parseLimit(searchParams.get('limit')),
      offset: parseOffset(searchParams.get('offset')),
    }),
    [searchParams],
  );

  const rangeInvalid =
    Boolean(params.from && params.to) &&
    Date.parse(params.from as string) > Date.parse(params.to as string);

  const query = useMemo<MovementQuery>(
    () => ({
      productId: params.productId,
      movementType: params.movementType,
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
    }),
    [params],
  );

  const update = useCallback(
    (patch: Partial<MovementListParams>) => {
      const merged = { ...params, ...patch };
      const next = new URLSearchParams(searchParams.toString());

      const filtersTouched = (
        ['productId', 'movementType', 'from', 'to', 'limit'] as const
      ).some((key) => key in patch);
      const offset = filtersTouched && !('offset' in patch) ? 0 : merged.offset;

      setOrDelete(next, 'product_id', merged.productId);
      setOrDelete(next, 'movement_type', merged.movementType);
      setOrDelete(next, 'from', merged.from);
      setOrDelete(next, 'to', merged.to);
      next.set('limit', String(merged.limit));
      next.set('offset', String(offset));

      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router, searchParams],
  );

  return { params, query, rangeInvalid, update };
}
