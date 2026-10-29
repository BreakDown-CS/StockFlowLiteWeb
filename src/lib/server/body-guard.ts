import type { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

import { BFF_ERROR } from '@/lib/api/errors';
import { parseBody } from '@/lib/validation/bodies';

import { newRequestId, readJsonBody } from './forward';
import { bffError, bffValidationError } from './respond';

/**
 * Reads and validates a JSON request body, returning either the parsed value or a ready
 * error response.
 *
 * Keeping this in one place means every mutation refuses non-JSON content types,
 * oversized payloads and invalid fields in exactly the same way — and always before the
 * request reaches the API.
 */
export async function readValidatedBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
): Promise<{ ok: true; value: z.infer<T> } | { ok: false; response: NextResponse }> {
  const requestId = newRequestId();

  const raw = await readJsonBody(request);
  if (!raw.ok) {
    return {
      ok: false,
      response: bffError(
        raw.reason === 'too-large'
          ? {
              status: 413,
              code: BFF_ERROR.PAYLOAD_TOO_LARGE,
              message: 'Request body is too large',
              requestId,
            }
          : {
              status: 415,
              code: BFF_ERROR.BAD_REQUEST,
              message: 'Expected application/json',
              requestId,
            },
        requestId,
      ),
    };
  }

  const parsed = parseBody(schema, raw.text);
  if (!parsed.ok) {
    return {
      ok: false,
      response:
        parsed.code === 'BAD_JSON'
          ? bffError(
              {
                status: 400,
                code: 'BAD_REQUEST',
                message: 'Malformed request payload',
                requestId,
              },
              requestId,
            )
          : bffValidationError(parsed.fields ?? {}, requestId),
    };
  }

  return { ok: true, value: parsed.value };
}

/** Standard response for a malformed route identifier. */
export function invalidIdResponse(requestId: string, message = 'Invalid identifier format'): NextResponse {
  return bffError({ status: 400, code: 'INVALID_ID', message, requestId }, requestId);
}

/**
 * Reads an OPTIONAL JSON body.
 *
 * The API accepts an empty body for `reject` and `cancel`, so an absent body must not be
 * an error — but a body that is present must still be valid JSON of the expected shape.
 */
export async function readOptionalBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
): Promise<
  { ok: true; value: z.infer<T> | undefined } | { ok: false; response: NextResponse }
> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { ok: true, value: undefined };
  }

  const requestId = newRequestId();
  const raw = await readJsonBody(request);
  if (!raw.ok) {
    return {
      ok: false,
      response: bffError(
        raw.reason === 'too-large'
          ? {
              status: 413,
              code: BFF_ERROR.PAYLOAD_TOO_LARGE,
              message: 'Request body is too large',
              requestId,
            }
          : {
              status: 415,
              code: BFF_ERROR.BAD_REQUEST,
              message: 'Expected application/json',
              requestId,
            },
        requestId,
      ),
    };
  }

  if (raw.text.trim().length === 0) {
    return { ok: true, value: undefined };
  }

  const parsed = parseBody(schema, raw.text);
  if (!parsed.ok) {
    return {
      ok: false,
      response:
        parsed.code === 'BAD_JSON'
          ? bffError(
              { status: 400, code: 'BAD_REQUEST', message: 'Malformed request payload', requestId },
              requestId,
            )
          : bffValidationError(parsed.fields ?? {}, requestId),
    };
  }

  return { ok: true, value: parsed.value };
}
