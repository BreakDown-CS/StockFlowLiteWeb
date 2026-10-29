'use client';

import { createContext, useContext, type ReactNode } from 'react';

import { can, type Capability, type Role } from '@/lib/rbac/permissions';

/**
 * Session context for client components.
 *
 * The identity is resolved on the server (`readSession`) and handed down once, so client
 * components never need an extra round trip to know who is signed in. This is a
 * rendering aid only: the API still authorizes every request.
 */

export type SessionUser = {
  id: string;
  username: string;
  role: Role;
};

export type SessionInfo = {
  user: SessionUser;
  /** Backend session expiry (ISO 8601), never extended client-side. */
  expiresAt: string | null;
};

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionInfo;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionInfo {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return session;
}

/** Returns a predicate for a single capability of the current user. */
export function useCan(): (capability: Capability) => boolean {
  const { user } = useSession();
  return (capability) => can(user.role, capability);
}
