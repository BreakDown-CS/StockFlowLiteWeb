import { bffRequest } from '@/lib/api/bff-client';
import type { PageMeta } from '@/lib/api/envelope';

import { toMovementReport } from './mappers';
import type { MovementQuery, MovementReport, MovementReportDTO } from './types';

/**
 * Movement ledger API.
 *
 * Uses the report endpoint: it is the only one that returns `sku`, `product_name` and
 * `signed_quantity`, which a readable ledger needs (the raw `/stock-movements` endpoint
 * returns just `product_id` and an unsigned quantity).
 */

export type MovementResult = {
  report: MovementReport;
  meta?: PageMeta;
};

function toSearchParams(query: MovementQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.productId) {
    params.set('product_id', query.productId);
  }
  if (query.movementType) {
    params.set('movement_type', query.movementType);
  }
  if (query.from) {
    params.set('from', query.from);
  }
  if (query.to) {
    params.set('to', query.to);
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set('offset', String(query.offset));
  }

  return params;
}

export async function fetchMovementReport(
  query: MovementQuery = {},
  signal?: AbortSignal,
): Promise<MovementResult> {
  const search = toSearchParams(query).toString();
  const path =
    search.length > 0
      ? `/api/bff/reports/stock-movements?${search}`
      : '/api/bff/reports/stock-movements';

  const response = await bffRequest<MovementReportDTO>(path, { signal });

  return {
    report: toMovementReport(response.data),
    meta: response.meta as PageMeta | undefined,
  };
}
