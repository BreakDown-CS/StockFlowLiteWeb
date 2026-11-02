import type { NextRequest } from 'next/server';

import { forward, newRequestId } from '@/lib/server/forward';
import { bffValidationError } from '@/lib/server/respond';
import { parseQuery } from '@/lib/validation/common';
import { requestReportQuerySchema } from '@/lib/validation/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/reports/stock-requests
 *
 * Request report with fulfilment aggregates. A REQUESTER is scoped to their own rows by
 * the API whatever `requester_id` says — that is the server's rule, not a UI filter.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = newRequestId();

  const parsed = parseQuery(requestReportQuerySchema, request.nextUrl.searchParams);
  if (!parsed.ok) {
    return bffValidationError(parsed.fields, requestId);
  }

  const { status, requester_id, from, to, limit, offset } = parsed.value;

  if (from && to && Date.parse(from) > Date.parse(to)) {
    return bffValidationError({ to: 'must be later than or equal to from' }, requestId);
  }

  return forward(request, {
    method: 'GET',
    path: '/api/v1/reports/stock-requests',
    query: { status, requester_id, from, to, limit, offset },
  });
}
