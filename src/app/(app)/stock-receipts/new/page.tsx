import type { Metadata } from 'next';

import { ReceiptScreen } from '@/features/stock-receipts/components/ReceiptScreen';

export const metadata: Metadata = {
  title: 'Receive stock',
};

export default function ReceiveStockPage() {
  return <ReceiptScreen />;
}
