'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flex, Layout, Menu, Space, Typography } from 'antd';

import { useSession } from '@/features/auth/session-context';
import { isActivePath, visibleNav } from '@/lib/rbac/navigation';

import { SessionExpiryBanner, SessionExpiryTag } from './SessionExpiry';
import { UserMenu } from './UserMenu';

/**
 * Authenticated shell: sidebar navigation generated from the capability matrix, an
 * account menu and the session-expiry indicator.
 *
 * Navigation is filtered by role, but that is presentation only — the API authorizes
 * every request regardless of what the sidebar shows.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, expiresAt } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = visibleNav(user.role);
  const active = items.find((item) => isActivePath(item.href, pathname));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Keyboard users land here first; visible only when focused. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Layout.Sider
        theme="light"
        width={240}
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        <div style={{ padding: collapsed ? '16px 8px' : '16px 24px' }}>
          <Typography.Text strong style={{ whiteSpace: 'nowrap' }}>
            {collapsed ? 'SF' : 'StockFlow Lite'}
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={active ? [active.key] : []}
          items={items.map((item) => ({
            key: item.key,
            disabled: !item.available,
            label: item.available ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <Space size={6}>
                <span>{item.label}</span>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  soon
                </Typography.Text>
              </Space>
            ),
          }))}
        />
      </Layout.Sider>

      <Layout>
        <Layout.Header
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #f0f0f0',
            paddingInline: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text type="secondary">Inventory operations</Typography.Text>
          <Space size={12}>
            <SessionExpiryTag expiresAt={expiresAt} />
            <UserMenu />
          </Space>
        </Layout.Header>

        <Layout.Content id="main-content" role="main" style={{ padding: 24 }} tabIndex={-1}>
          <Flex vertical gap={16} style={{ maxWidth: 1100, margin: '0 auto' }}>
            <SessionExpiryBanner expiresAt={expiresAt} />
            {children}
          </Flex>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
