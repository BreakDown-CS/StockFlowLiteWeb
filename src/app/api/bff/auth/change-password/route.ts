import type { NextRequest } from 'next/server';

import { readValidatedBody } from '@/lib/server/body-guard';
import { forward } from '@/lib/server/forward';
import { clearSessionCookies } from '@/lib/server/session';
import { changePasswordBodySchema } from '@/lib/validation/bodies';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/bff/auth/change-password
 *
 * The API revokes **every** session of the user after a password change, so the BFF clears
 * its own cookie on success as well: keeping it would only produce a 401 on the next call.
 * The client is expected to send the user back to the sign-in screen.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body = await readValidatedBody(request, changePasswordBodySchema);
  if (!body.ok) {
    return body.response;
  }

  const response = await forward(request, {
    method: 'POST',
    path: '/api/v1/auth/change-password',
    body: body.value,
  });

  if (response.status === 200) {
    clearSessionCookies(response);
  }

  return response;
}
