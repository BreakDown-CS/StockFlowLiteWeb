import type { NextRequest } from 'next/server';

import { newRequestId, forward } from '@/lib/server/forward';
import { bffValidationError } from '@/lib/server/respond';
import { parseQuery } from '@/lib/validation/common';
import { inventoryReportQuerySchema } from '@/lib/validation/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/reports/inventory
 *
 * Stock snapshot with low-stock and out-of-stock flags plus an aggregate summary.
 * The summary always describes the FILTERED set (API behaviour), so the dashboard
 * requests it twice: once unfiltered for the counters, once with `low_stock=true` for
 * the table.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = newRequestId();

  const parsed = parseQuery(inventoryReportQuerySchema, request.nextUrl.searchParams);
  if (!parsed.ok) {
    return bffValidationError(parsed.fields, requestId);
  }

  const { search, is_active, low_stock, limit, offset } = parsed.value;

  return forward(request, {
    method: 'GET',
    path: '/api/v1/reports/inventory',
    query: { search, is_active, low_stock, limit, offset },
  });
}
