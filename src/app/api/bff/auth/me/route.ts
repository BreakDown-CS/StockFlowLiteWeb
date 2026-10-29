import type { NextRequest } from 'next/server';

import { forward } from '@/lib/server/forward';
import { readSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bff/auth/me
 *
 * Returns the caller's own account plus the authoritative session expiry, so the UI
 * can warn before a session ends. The API response is passed through the standard
 * forwarding pipeline (auth, error normalisation, 401 handling).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await readSession();
  const expiresAt =
    session === null ? null : new Date(session.exp * 1000).toISOString();

  return forward(request, {
    method: 'GET',
    path: '/api/v1/auth/me',
    mapSuccess: (data) => ({ user: data, expires_at: expiresAt }),
  });
}
