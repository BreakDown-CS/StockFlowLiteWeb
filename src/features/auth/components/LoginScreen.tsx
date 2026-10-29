'use client';

import { Suspense } from 'react';
import { Card, Flex, Typography } from 'antd';

import { LoginForm } from './LoginForm';

/**
 * Sign-in screen shell.
 *
 * Ant Design components do not ship a `'use client'` banner of their own, so they must
 * be rendered from a client component. The page itself stays a Server Component (it
 * only provides metadata), which keeps the server/client boundary explicit and avoids
 * resolving antd's barrel export inside the RSC graph.
 */
export function LoginScreen() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <Flex vertical gap={4} style={{ marginBottom: 24 }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            StockFlow Lite
          </Typography.Title>
          <Typography.Text type="secondary">
            Inventory, requests and stock movements
          </Typography.Text>
        </Flex>

        <Suspense fallback={<Typography.Text type="secondary">Loading…</Typography.Text>}>
          <LoginForm />
        </Suspense>
      </Card>
    </main>
  );
}
