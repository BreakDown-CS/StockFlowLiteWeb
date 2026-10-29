import type { Metadata } from 'next';

import { ProductDetailScreen } from '@/features/products/components/ProductDetailScreen';

export const metadata: Metadata = {
  title: 'Product',
};

/** Next 16 passes route params as a promise. */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailScreen id={id} />;
}
