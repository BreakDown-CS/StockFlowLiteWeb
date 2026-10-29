import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from 'antd';

import { MovementsScreen } from '@/features/stock-movements/components/MovementsScreen';

export const metadata: Metadata = {
  title: 'Stock movements',
};

export default function MovementsPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <MovementsScreen />
    </Suspense>
  );
}
