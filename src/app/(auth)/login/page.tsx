import type { Metadata } from 'next';

import { LoginScreen } from '@/features/auth/components/LoginScreen';

export const metadata: Metadata = {
  title: 'Sign in',
};

/**
 * A per-request CSP nonce can only be stamped into dynamically rendered HTML, so this page
 * is explicitly dynamic. Without it the prerendered document would ship scripts that the
 * `script-src 'nonce-…'` policy blocks — the page would render but never hydrate.
 */
export const dynamic = 'force-dynamic';

/**
 * Sign-in route.
 *
 * Stays a Server Component: no antd imports here (see LoginScreen for why). The URL
 * parameters `?next=` and `?reason=` are read inside the client form.
 */
export default function LoginPage() {
  return <LoginScreen />;
}
