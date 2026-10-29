import type { Metadata } from 'next';

import { CreateRequestScreen } from '@/features/stock-requests/components/CreateRequestScreen';

export const metadata: Metadata = {
  title: 'New stock request',
};

export default function NewStockRequestPage() {
  return <CreateRequestScreen />;
}
