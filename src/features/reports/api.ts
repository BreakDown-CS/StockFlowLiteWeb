import { bffRequest } from '@/lib/api/bff-client';
import type { PageMeta } from '@/lib/api/envelope';

import { toInventoryReport } from './mappers';
import type { InventoryQuery, InventoryReport, InventoryReportDTO } from './types';

/**
 * Report API calls.
 *
 * Every call goes through the BFF; the browser never sees the API token. The BFF has
 * already validated the parameters, so this module only has to serialise them.
 */

export type InventoryResult = {
  report: InventoryReport;
  meta?: PageMeta;
};

function toSearchParams(query: InventoryQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.search) {
    params.set('search', query.search);
  }
  if (query.isActive) {
    params.set('is_active', query.isActive);
  }
  if (query.lowStock !== undefined) {
    params.set('low_stock', String(query.lowStock));
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set('offset', String(query.offset));
  }

  return params;
}

export async function fetchInventoryReport(
  query: InventoryQuery = {},
  signal?: AbortSignal,
): Promise<InventoryResult> {
  const params = toSearchParams(query).toString();
  const path = params.length > 0 ? `/api/bff/reports/inventory?${params}` : '/api/bff/reports/inventory';

  const response = await bffRequest<InventoryReportDTO>(path, { signal });

  return {
    report: toInventoryReport(response.data),
    meta: response.meta as PageMeta | undefined,
  };
}
