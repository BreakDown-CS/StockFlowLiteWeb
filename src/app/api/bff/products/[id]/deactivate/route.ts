import type { NextRequest } from 'next/server';

import { invalidIdResponse } from '@/lib/server/body-guard';
import { forward, newRequestId } from '@/lib/server/forward';
import { isUuid } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/bff/products/:id/deactivate
 *
 * Irreversible: the API has no activate endpoint, so the UI must confirm with explicit
 * copy before calling this.
 */
export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return invalidIdResponse(newRequestId(), 'Invalid product ID format');
  }

  return forward(request, { method: 'PATCH', path: `/api/v1/products/${id}/deactivate` });
}
