'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button, Result } from 'antd';

import { useCan } from '@/features/auth/session-context';
import type { Capability } from '@/lib/rbac/permissions';

/**
 * Renders a 403 page instead of the protected content when the current role lacks the
 * capability. This is a UX guard for direct URL entry, not an authorization control:
 * the API rejects the underlying requests anyway.
 */
export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const can = useCan();

  if (can(capability)) {
    return <>{children}</>;
  }

  return (
    <Result
      status="403"
      title="403"
      subTitle="Your account does not have permission to open this page."
      extra={
        <Link href="/">
          <Button type="primary">Back to dashboard</Button>
        </Link>
      }
    />
  );
}
