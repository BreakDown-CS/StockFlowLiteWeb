import type { Metadata } from 'next';

import { ChangePasswordScreen } from '@/features/auth/components/ChangePasswordScreen';

export const metadata: Metadata = {
  title: 'Change password',
};

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
