import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Skeleton } from 'antd';

import { ProductsScreen } from '@/features/products/components/ProductsScreen';

export const metadata: Metadata = {
  title: 'Products',
};

/**
 * Product list route.
 *
 * Wrapped in Suspense because the screen reads the query string with `useSearchParams`;
 * the skeleton is what a slow connection sees while the list resolves.
 */
export default function ProductsPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <ProductsScreen />
    </Suspense>
  );
}
