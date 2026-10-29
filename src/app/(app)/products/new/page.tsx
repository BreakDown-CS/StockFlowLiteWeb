import type { Metadata } from 'next';

import { ProductCreateScreen } from '@/features/products/components/ProductFormScreen';

export const metadata: Metadata = {
  title: 'New product',
};

export default function NewProductPage() {
  return <ProductCreateScreen />;
}
