import { bffRequest } from '@/lib/api/bff-client';
import type { PageMeta } from '@/lib/api/envelope';

import { toCreateRequestBody, toStockRequest } from './mappers';
import type {
  CreateRequestInput,
  IssueMeta,
  IssueResult,
  StockIssueResultDTO,
  StockRequest,
  StockRequestDTO,
  StockRequestQuery,
} from './types';

/** Stock request API calls (browser → BFF → Go API). */

export type RequestListResult = {
  items: StockRequest[];
  meta?: PageMeta;
};

function toSearchParams(query: StockRequestQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
  if (query.offset !== undefined) {
    params.set('offset', String(query.offset));
  }
  return params;
}

export async function fetchRequests(
  query: StockRequestQuery = {},
  signal?: AbortSignal,
): Promise<RequestListResult> {
  const search = toSearchParams(query).toString();
  const path = search.length > 0 ? `/api/bff/stock-requests?${search}` : '/api/bff/stock-requests';

  const response = await bffRequest<StockRequestDTO[]>(path, { signal });

  return {
    items: response.data.map(toStockRequest),
    meta: response.meta as PageMeta | undefined,
  };
}

export async function fetchRequest(id: string, signal?: AbortSignal): Promise<StockRequest> {
  const response = await bffRequest<StockRequestDTO>(`/api/bff/stock-requests/${id}`, { signal });
  return toStockRequest(response.data);
}

export async function createRequest(input: CreateRequestInput): Promise<StockRequest> {
  const response = await bffRequest<StockRequestDTO>('/api/bff/stock-requests', {
    method: 'POST',
    body: toCreateRequestBody(input),
  });
  return toStockRequest(response.data);
}

export async function approveRequest(id: string): Promise<StockRequest> {
  const response = await bffRequest<StockRequestDTO>(
    `/api/bff/stock-requests/${id}/approve`,
    { method: 'POST' },
  );
  return toStockRequest(response.data);
}

export async function rejectRequest(id: string, reason?: string): Promise<StockRequest> {
  const response = await bffRequest<StockRequestDTO>(
    `/api/bff/stock-requests/${id}/reject`,
    { method: 'POST', body: { rejection_reason: reason ?? '' } },
  );
  return toStockRequest(response.data);
}

export async function cancelRequest(id: string, reason?: string): Promise<StockRequest> {
  const response = await bffRequest<StockRequestDTO>(`/api/bff/stock-requests/${id}/cancel`, {
    method: 'POST',
    body: { reason: reason ?? '' },
  });
  return toStockRequest(response.data);
}

/**
 * Issues an approved request. The idempotency key MUST be stable across retries of the
 * same logical action — that is what makes a timed-out attempt safe to repeat.
 */
export async function issueRequest(id: string, idempotencyKey: string): Promise<IssueResult> {
  const response = await bffRequest<StockIssueResultDTO>(
    `/api/bff/stock-requests/${id}/issue`,
    { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey } },
  );

  const meta = (response.meta ?? {}) as IssueMeta;

  return {
    request: toStockRequest(response.data.request),
    movementsCount: response.data.movements.length,
    idempotentReplay: meta.idempotent_replay === true,
    issuanceId: typeof meta.issuance_id === 'string' ? meta.issuance_id : null,
  };
}
