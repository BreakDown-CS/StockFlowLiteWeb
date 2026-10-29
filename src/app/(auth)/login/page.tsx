import type { Metadata } from 'next';

import { LoginScreen } from '@/features/auth/components/LoginScreen';

export const metadata: Metadata = {
  title: 'Sign in',
};

/**
 * Sign-in route.
 *
 * Stays a Server Component: no antd imports here (see LoginScreen for why). The URL
 * parameters `?next=` and `?reason=` are read inside the client form.
 */
export default function LoginPage() {
  return <LoginScreen />;
}
