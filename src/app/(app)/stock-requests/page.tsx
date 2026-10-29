import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from 'antd';

import { RequestsScreen } from '@/features/stock-requests/components/RequestsScreen';

export const metadata: Metadata = {
  title: 'Stock requests',
};

export default function StockRequestsPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <RequestsScreen />
    </Suspense>
  );
}
