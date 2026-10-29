'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Flex, Result, Skeleton, Space, Tag, Typography } from 'antd';

import { useCan } from '@/features/auth/session-context';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useDeactivateProduct, useProduct } from '../hooks';
import { DeactivateProductButton } from './DeactivateProductButton';

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/** Product detail screen. */
export function ProductDetailScreen({ id }: { id: string }) {
  const can = useCan();
  const { message } = App.useApp();
  const productQuery = useProduct(id);
  const deactivate = useDeactivateProduct();
  const [deactivating, setDeactivating] = useState(false);

  async function handleDeactivate(): Promise<void> {
    setDeactivating(true);
    try {
      await deactivate.mutateAsync(id);
      await productQuery.refetch();
    } catch (error) {
      message.error(errorText(error));
      throw error;
    } finally {
      setDeactivating(false);
    }
  }

  if (productQuery.isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (productQuery.isError) {
    const notFound =
      productQuery.error instanceof ApiError && productQuery.error.status === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Product not found' : 'Product could not be loaded'}
        subTitle={notFound ? 'It may have been removed, or the link is wrong.' : errorText(productQuery.error)}
        extra={
          <Link href="/products">
            <Button type="primary">Back to products</Button>
          </Link>
        }
      />
    );
  }

  const product = productQuery.data;
  if (!product) {
    return null;
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={4}>
          <Space size={8} align="center">
            <Typography.Title level={2} style={{ margin: 0 }}>
              {product.name}
            </Typography.Title>
            <Tag color={product.isActive ? 'green' : undefined}>
              {product.isActive ? 'Active' : 'Inactive'}
            </Tag>
          </Space>
          <Typography.Text type="secondary">
            {product.sku} · on hand {product.currentStock} {product.unit}
          </Typography.Text>
        </Flex>

        <Space wrap>
          <Link href="/products">
            <Button>Back</Button>
          </Link>
          {can('product:update') && (
            <Link href={`/products/${product.id}/edit`}>
              <Button>Edit</Button>
            </Link>
          )}
          {can('product:deactivate') && product.isActive && (
            <DeactivateProductButton
              product={product}
              size="middle"
              onConfirm={handleDeactivate}
            />
          )}
        </Space>
      </Flex>

      {!product.isActive ? (
        <Alert
          type="warning"
          showIcon
          message="This product is inactive"
          description="No stock can be received or requested for it, and there is no reactivate endpoint in the API."
        />
      ) : null}

      {deactivating ? <Skeleton active paragraph={{ rows: 1 }} /> : null}

      <Card title="Details">
        <Descriptions
          column={1}
          size="small"
          items={[
            { key: 'sku', label: 'SKU', children: <Typography.Text code>{product.sku}</Typography.Text> },
            { key: 'name', label: 'Name', children: product.name },
            { key: 'unit', label: 'Unit', children: product.unit },
            {
              key: 'stock',
              label: 'Current stock',
              children: `${product.currentStock} ${product.unit}`,
            },
            { key: 'min', label: 'Minimum stock', children: product.minStock },
            {
              key: 'low',
              label: 'Stock status',
              children:
                product.isActive && product.currentStock <= product.minStock ? (
                  <Tag color="orange">At or below minimum</Tag>
                ) : (
                  <Typography.Text type="secondary">—</Typography.Text>
                ),
            },
            {
              key: 'description',
              label: 'Description',
              children: product.description || <Typography.Text type="secondary">—</Typography.Text>,
            },
            {
              key: 'created',
              label: 'Created',
              children: new Date(product.createdAt).toLocaleString(),
            },
            {
              key: 'updated',
              label: 'Last updated',
              children: new Date(product.updatedAt).toLocaleString(),
            },
          ]}
        />
      </Card>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        Stock moves only through receipts and issues; this screen never edits the balance.
      </Typography.Paragraph>
    </Flex>
  );
}
