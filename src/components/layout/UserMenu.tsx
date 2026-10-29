'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Dropdown, Space, Tag, Typography } from 'antd';

import { logout } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-context';

/** Account menu: identity, role badge and sign-out. */
export function UserMenu() {
  const { user } = useSession();
  const router = useRouter();
  const { message } = App.useApp();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Logout is idempotent server-side and always clears the cookies, so a failure
      // must never trap the user inside the app.
    } finally {
      setSigningOut(false);
      message.success('Signed out');
      router.replace('/login');
      router.refresh();
    }
  }

  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          { key: 'username', label: `Signed in as ${user.username}`, disabled: true },
          { key: 'role', label: `Role: ${user.role}`, disabled: true },
          { type: 'divider' },
          { key: 'signout', label: 'Sign out' },
        ],
        onClick: ({ key }) => {
          if (key === 'signout') {
            void handleSignOut();
          }
        },
      }}
    >
      <Button type="text" loading={signingOut}>
        <Space size={8}>
          <Typography.Text>{user.username}</Typography.Text>
          <Tag color="blue">{user.role}</Tag>
        </Space>
      </Button>
    </Dropdown>
  );
}
