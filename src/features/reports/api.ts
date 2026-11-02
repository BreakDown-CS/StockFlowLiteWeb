import { bffRequest } from '@/lib/api/bff-client';
import type { PageMeta } from '@/lib/api/envelope';

import { toInventoryReport, toRequestReport } from './mappers';
import type {
  InventoryQuery,
  InventoryReport,
  InventoryReportDTO,
  RequestReport,
  RequestReportDTO,
  RequestReportQuery,
} from './types';

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

export type RequestReportResult = {
  report: RequestReport;
  meta?: PageMeta;
};

function toRequestParams(query: RequestReportQuery): URLSearchParams {
  const params = new URLSearchParams();

  if (query.status) {
    params.set('status', query.status);
  }
  if (query.requesterId) {
    params.set('requester_id', query.requesterId);
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

/**
 * Request report.
 *
 * A REQUESTER is scoped to their own requests by the API regardless of `requester_id`,
 * so the screen hides that filter for them instead of pretending it works.
 */
export async function fetchRequestReport(
  query: RequestReportQuery = {},
  signal?: AbortSignal,
): Promise<RequestReportResult> {
  const search = toRequestParams(query).toString();
  const path =
    search.length > 0
      ? `/api/bff/reports/stock-requests?${search}`
      : '/api/bff/reports/stock-requests';

  const response = await bffRequest<RequestReportDTO>(path, { signal });

  return {
    report: toRequestReport(response.data),
    meta: response.meta as PageMeta | undefined,
  };
}
