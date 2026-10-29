import type { NextRequest } from 'next/server';

import { BFF_ERROR } from '@/lib/api/errors';
import { invalidIdResponse, readOptionalBody } from '@/lib/server/body-guard';
import { forward, newRequestId } from '@/lib/server/forward';
import { bffError } from '@/lib/server/respond';
import {
  cancelRequestBodySchema,
  isIdempotencyKey,
  rejectRequestBodySchema,
} from '@/lib/validation/bodies';
import { isUuid } from '@/lib/validation/common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bff/stock-requests/:id/:action
 *
 * The action is an allowlist, not a passthrough: only these four workflow steps exist,
 * and each maps to one fixed upstream path. `reject` and `cancel` accept an optional body;
 * `issue` is the only action that honours `Idempotency-Key`.
 */

const ACTIONS = ['approve', 'reject', 'cancel', 'issue'] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: string): value is Action {
  return (ACTIONS as readonly string[]).includes(value);
}

type RouteContext = { params: Promise<{ id: string; action: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { id, action } = await context.params;
  const requestId = newRequestId();

  if (!isUuid(id)) {
    return invalidIdResponse(requestId, 'Invalid stock request ID format');
  }
  if (!isAction(action)) {
    return bffError(
      {
        status: 404,
        code: BFF_ERROR.ROUTE_NOT_ALLOWED,
        message: 'Unknown stock request action',
        requestId,
      },
      requestId,
    );
  }

  if (action === 'approve') {
    return forward(request, { method: 'POST', path: `/api/v1/stock-requests/${id}/approve` });
  }

  if (action === 'reject') {
    const body = await readOptionalBody(request, rejectRequestBodySchema);
    if (!body.ok) {
      return body.response;
    }
    return forward(request, {
      method: 'POST',
      path: `/api/v1/stock-requests/${id}/reject`,
      body: body.value,
    });
  }

  if (action === 'cancel') {
    const body = await readOptionalBody(request, cancelRequestBodySchema);
    if (!body.ok) {
      return body.response;
    }
    return forward(request, {
      method: 'POST',
      path: `/api/v1/stock-requests/${id}/cancel`,
      body: body.value,
    });
  }

  const key = request.headers.get('idempotency-key');
  if (key !== null && !isIdempotencyKey(key)) {
    return bffError(
      {
        status: 400,
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'idempotency key must be 8-100 characters using A-Z a-z 0-9 . _ : -',
        requestId,
      },
      requestId,
    );
  }

  return forward(request, {
    method: 'POST',
    path: `/api/v1/stock-requests/${id}/issue`,
    idempotencyKey: key ?? undefined,
  });
}
