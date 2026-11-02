import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from 'antd';

import { InventoryReportScreen } from '@/features/reports/components/InventoryReportScreen';

export const metadata: Metadata = {
  title: 'Inventory report',
};

export default function InventoryReportPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <InventoryReportScreen />
    </Suspense>
  );
}
