import type { NextRequest } from 'next/server';

import { invalidIdResponse } from '@/lib/server/body-guard';
import { forward, newRequestId } from '@/lib/server/forward';
import { isUuid } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/bff/stock-requests/:id
 *
 * Another requester's request comes back as 404 (not 403) by design, so the UI must treat
 * "not found" and "not yours" identically.
 */
export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return invalidIdResponse(newRequestId(), 'Invalid stock request ID format');
  }

  return forward(request, { method: 'GET', path: `/api/v1/stock-requests/${id}` });
}
