import type { NextRequest } from 'next/server';

import { invalidIdResponse, readValidatedBody } from '@/lib/server/body-guard';
import { forward, newRequestId } from '@/lib/server/forward';
import { isUuid } from '@/lib/validation/common';
import { updateProductBodySchema } from '@/lib/validation/bodies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/bff/products/:id */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return invalidIdResponse(newRequestId(), 'Invalid product ID format');
  }

  return forward(request, { method: 'GET', path: `/api/v1/products/${id}` });
}

/**
 * PUT /api/bff/products/:id
 *
 * The API's update contract has no `sku` field, so it is not accepted here either: an
 * edit must never look like it could rename a SKU.
 */
export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return invalidIdResponse(newRequestId(), 'Invalid product ID format');
  }

  const body = await readValidatedBody(request, updateProductBodySchema);
  if (!body.ok) {
    return body.response;
  }

  const { name, description, unit, min_stock } = body.value;

  return forward(request, {
    method: 'PUT',
    path: `/api/v1/products/${id}`,
    body: { name, description, unit, min_stock },
  });
}
