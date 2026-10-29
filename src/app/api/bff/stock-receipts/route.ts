import type { NextRequest } from 'next/server';

import { readValidatedBody } from '@/lib/server/body-guard';
import { forward } from '@/lib/server/forward';
import { createReceiptBodySchema } from '@/lib/validation/bodies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bff/stock-receipts
 *
 * Records an inbound delivery. The API increments stock and appends one RECEIPT
 * movement inside the same transaction; the UI must refresh both.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await readValidatedBody(request, createReceiptBodySchema);
  if (!body.ok) {
    return body.response;
  }

  const { product_id, quantity, notes } = body.value;

  return forward(request, {
    method: 'POST',
    path: '/api/v1/stock-receipts',
    body: { product_id, quantity, notes },
  });
}
