import type { NextRequest } from 'next/server';

import { readValidatedBody } from '@/lib/server/body-guard';
import { forward, newRequestId } from '@/lib/server/forward';
import { bffValidationError } from '@/lib/server/respond';
import { parseQuery } from '@/lib/validation/common';
import { createStockRequestBodySchema } from '@/lib/validation/bodies';
import { stockRequestsQuerySchema } from '@/lib/validation/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/stock-requests
 *
 * A REQUESTER only ever sees their own requests — enforced by the API, not by a query
 * parameter, so there is deliberately no "requester" filter here.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = newRequestId();

  const parsed = parseQuery(stockRequestsQuerySchema, request.nextUrl.searchParams);
  if (!parsed.ok) {
    return bffValidationError(parsed.fields, requestId);
  }

  const { status, limit, offset } = parsed.value;

  return forward(request, {
    method: 'GET',
    path: '/api/v1/stock-requests',
    query: { status, limit, offset },
  });
}

/** POST /api/bff/stock-requests — submit a request in PENDING state. */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await readValidatedBody(request, createStockRequestBodySchema);
  if (!body.ok) {
    return body.response;
  }

  const { items, notes } = body.value;

  return forward(request, {
    method: 'POST',
    path: '/api/v1/stock-requests',
    body: { items, notes },
  });
}
