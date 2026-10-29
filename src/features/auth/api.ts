'use client';

import { bffRequest } from '@/lib/api/bff-client';

import type { Role } from '@/lib/rbac/permissions';

/** Auth API calls (browser side). */

export type MeUser = {
  id: string;
  username: string;
  role: Role;
  is_active?: boolean;
  last_login_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type MeResult = {
  user: MeUser;
  expires_at: string | null;
};

export async function fetchMe(signal?: AbortSignal): Promise<MeResult> {
  const response = await bffRequest<MeResult>('/api/bff/auth/me', { signal });
  return response.data;
}

export async function logout(): Promise<void> {
  await bffRequest('/api/bff/auth/logout', { method: 'POST' });
}
