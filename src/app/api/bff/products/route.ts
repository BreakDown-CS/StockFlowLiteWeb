import type { NextRequest } from 'next/server';

import { readValidatedBody } from '@/lib/server/body-guard';
import { forward, newRequestId } from '@/lib/server/forward';
import { bffValidationError } from '@/lib/server/respond';
import { parseQuery } from '@/lib/validation/common';
import { createProductBodySchema } from '@/lib/validation/bodies';
import { productsQuerySchema } from '@/lib/validation/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/bff/products — paged product list. */
export async function GET(request: NextRequest): Promise<Response> {
  const requestId = newRequestId();

  const parsed = parseQuery(productsQuerySchema, request.nextUrl.searchParams);
  if (!parsed.ok) {
    return bffValidationError(parsed.fields, requestId);
  }

  const { search, is_active, limit, offset } = parsed.value;

  return forward(request, {
    method: 'GET',
    path: '/api/v1/products',
    query: { search, is_active, limit, offset },
  });
}

/** POST /api/bff/products — create a product (storekeeper/admin). */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await readValidatedBody(request, createProductBodySchema);
  if (!body.ok) {
    return body.response;
  }

  const { sku, name, description, unit, min_stock } = body.value;

  return forward(request, {
    method: 'POST',
    path: '/api/v1/products',
    // `undefined` fields are dropped when the body is serialised, so optional values are
    // omitted rather than sent as null (the API rejects null for these fields).
    body: { sku, name, description, unit, min_stock },
  });
}
