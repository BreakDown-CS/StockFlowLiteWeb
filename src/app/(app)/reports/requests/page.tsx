import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from 'antd';

import { RequestReportScreen } from '@/features/reports/components/RequestReportScreen';

export const metadata: Metadata = {
  title: 'Request report',
};

export default function RequestReportPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <RequestReportScreen />
    </Suspense>
  );
}
