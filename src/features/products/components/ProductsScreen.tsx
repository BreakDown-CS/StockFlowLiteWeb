'use client';

import Link from 'next/link';
import { Alert, App, Button, Card, Flex, Typography } from 'antd';

import { useCan } from '@/features/auth/session-context';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useDeactivateProduct, useProducts } from '../hooks';
import type { Product } from '../types';
import { useProductListParams } from '../use-list-params';
import { ProductFilters } from './ProductFilters';
import { ProductTable } from './ProductTable';

function errorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  return messageForCode(code);
}

/** Product list screen. All list state lives in the URL. */
export function ProductsScreen() {
  const can = useCan();
  const { message } = App.useApp();
  const { params, query, update } = useProductListParams();

  const productsQuery = useProducts(query);
  const deactivate = useDeactivateProduct();

  async function handleDeactivate(product: Product): Promise<void> {
    try {
      await deactivate.mutateAsync(product.id);
      // The row disappears from the default (active) filter once the list refetches.
      await productsQuery.refetch();
    } catch (error) {
      message.error(errorText(error));
      throw error;
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Products
          </Typography.Title>
          <Typography.Text type="secondary">
            Inventory items, their unit and their minimum stock level.
          </Typography.Text>
        </Flex>
        {can('product:create') && (
          <Link href="/products/new">
            <Button type="primary">New product</Button>
          </Link>
        )}
      </Flex>

      <Card>
        <Flex vertical gap={16}>
          <ProductFilters
            search={params.search}
            isActive={params.isActive}
            onChange={update}
          />

          {productsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load products"
              description={errorText(productsQuery.error)}
              action={
                <Button size="small" onClick={() => void productsQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <ProductTable
              items={productsQuery.data?.items ?? []}
              meta={productsQuery.data?.meta}
              loading={productsQuery.isLoading || productsQuery.isFetching}
              onDeactivate={handleDeactivate}
              onPageChange={(page, pageSize) =>
                update({ limit: pageSize, offset: (page - 1) * pageSize })
              }
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
