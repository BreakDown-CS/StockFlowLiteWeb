'use client';

import { useState, type ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { themeConfig } from '@/lib/theme';

/**
 * Client-side provider stack.
 *
 * Ant Design's `App` component provides the message/notification/modal Context API.
 * Components must consume it via `App.useApp()` instead of the static helpers so the
 * theme and React 19 context rules are respected.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Lists are offset-paginated; short staleness keeps pages from jumping.
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            // Writes are not idempotent except issue, so never auto-retry them.
            retry: 0,
          },
        },
      }),
  );

  return (
    <ConfigProvider theme={themeConfig}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
