import { redirect } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { SessionWatcher } from '@/features/auth/components/SessionWatcher';
import { SessionProvider } from '@/features/auth/session-context';
import { readSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/**
 * Authenticated area layout.
 *
 * The session is re-validated on the server for every request: the cookie is decrypted,
 * its expiry checked, and only then is the identity handed to the client. The proxy
 * redirect is a UX shortcut that a stale cookie can fool; this check cannot.
 *
 * `force-dynamic` is deliberate — an auth-gated shell must never be prerendered into a
 * static page that could be served without a session.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();

  if (!session) {
    redirect('/login?reason=session_expired');
  }

  return (
    <SessionProvider
      session={{
        user: { id: session.user.id, username: session.user.username, role: session.user.role },
        expiresAt: new Date(session.exp * 1000).toISOString(),
      }}
    >
      <SessionWatcher />
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
