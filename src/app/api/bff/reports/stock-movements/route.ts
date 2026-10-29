import type { NextRequest } from 'next/server';

import { forward, newRequestId } from '@/lib/server/forward';
import { bffValidationError } from '@/lib/server/respond';
import { parseQuery } from '@/lib/validation/common';
import { movementReportQuerySchema } from '@/lib/validation/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/reports/stock-movements
 *
 * The ledger screen uses this endpoint rather than `/stock-movements` because the report
 * row carries what a ledger needs to be readable: `sku`, `product_name`,
 * `signed_quantity` and the actor. The plain ledger endpoint returns only `product_id`
 * and an unsigned quantity, so it cannot render a usable table on its own.
 *
 * Like the API, there is no default date range: omitting `from`/`to` scans everything.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = newRequestId();

  const parsed = parseQuery(movementReportQuerySchema, request.nextUrl.searchParams);
  if (!parsed.ok) {
    return bffValidationError(parsed.fields, requestId);
  }

  const { product_id, movement_type, from, to, limit, offset } = parsed.value;

  // Reject an inverted range before it reaches the API, so the UI never has to explain a
  // round trip for something it can see locally.
  if (from && to && Date.parse(from) > Date.parse(to)) {
    return bffValidationError({ to: 'must be later than or equal to from' }, requestId);
  }

  return forward(request, {
    method: 'GET',
    path: '/api/v1/reports/stock-movements',
    query: { product_id, movement_type, from, to, limit, offset },
  });
}
