import type { Metadata } from 'next';

import { ProductEditScreen } from '@/features/products/components/ProductFormScreen';

export const metadata: Metadata = {
  title: 'Edit product',
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductEditScreen id={id} />;
}
