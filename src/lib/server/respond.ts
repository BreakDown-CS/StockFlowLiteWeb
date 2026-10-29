import { NextResponse } from 'next/server';

import { envelopeFromError, type NormalizedError } from '@/lib/api/errors';

/**
 * Response helpers for BFF route handlers.
 *
 * Every BFF response is non-cacheable: they are all user-specific and several carry
 * fresh session state. A shared cache (or the browser back/forward cache) must never
 * be able to serve one user's data to another.
 */

export function bffJson(status: number, body: unknown, requestId: string): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('x-bff-request-id', requestId);
  return response;
}

/** Returns the standard failure envelope for a normalised error. */
export function bffError(error: NormalizedError, requestId: string): NextResponse {
  return bffJson(error.status, envelopeFromError(error), requestId);
}

/**
 * Returns a 400 `VALIDATION_ERROR` using the same code and shape the API produces,
 * so the client has exactly one vocabulary for invalid input.
 */
export function bffValidationError(
  fields: Record<string, string>,
  requestId: string,
): NextResponse {
  return bffError(
    {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'One or more parameters are not valid',
      details: { fields },
      requestId,
    },
    requestId,
  );
}
