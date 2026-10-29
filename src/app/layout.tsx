import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'StockFlow Lite',
    template: '%s · StockFlow Lite',
  },
  description: 'Inventory, stock requests and movement tracking for StockFlow Lite.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* AntdRegistry extracts Ant Design's CSS-in-JS during SSR to avoid a style flash. */}
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
