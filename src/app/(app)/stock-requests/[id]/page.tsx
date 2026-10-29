import type { Metadata } from 'next';

import { RequestDetailScreen } from '@/features/stock-requests/components/RequestDetailScreen';

export const metadata: Metadata = {
  title: 'Stock request',
};

export default async function StockRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetailScreen id={id} />;
}
