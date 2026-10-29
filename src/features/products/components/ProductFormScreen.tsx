'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Card, Flex, Result, Skeleton, Tag, Typography } from 'antd';

import { RequireCapability } from '@/components/RequireCapability';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useCreateProduct, useProduct, useUpdateProduct } from '../hooks';
import { ProductForm, type ProductFormValues } from './ProductForm';

function extractFieldErrors(error: unknown): Record<string, string> | undefined {
  if (!(error instanceof ApiError)) {
    return undefined;
  }
  const details = error.details as { fields?: Record<string, string> } | undefined;
  return details?.fields;
}

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/** Create screen. */
export function ProductCreateScreen() {
  const router = useRouter();
  const { message } = App.useApp();
  const create = useCreateProduct();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>();

  async function handleSubmit(values: ProductFormValues): Promise<void> {
    setFieldErrors(undefined);
    try {
      const product = await create.mutateAsync({
        sku: values.sku,
        name: values.name,
        description: values.description,
        unit: values.unit,
        minStock: values.minStock,
      });
      message.success('Product created');
      router.push(`/products/${product.id}`);
    } catch (error) {
      const fields = extractFieldErrors(error);
      if (fields) {
        setFieldErrors(fields);
        return;
      }
      message.error(errorText(error));
    }
  }

  return (
    <RequireCapability capability="product:create">
      <Flex vertical gap={16}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          New product
        </Typography.Title>
        <Card>
          <ProductForm
            mode="create"
            submitting={create.isPending}
            fieldErrors={fieldErrors}
            onSubmit={handleSubmit}
          />
        </Card>
      </Flex>
    </RequireCapability>
  );
}

/** Edit screen. */
export function ProductEditScreen({ id }: { id: string }) {
  const router = useRouter();
  const { message } = App.useApp();
  const productQuery = useProduct(id);
  const update = useUpdateProduct(id);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>();

  async function handleSubmit(values: ProductFormValues): Promise<void> {
    setFieldErrors(undefined);
    try {
      await update.mutateAsync({
        name: values.name,
        description: values.description,
        unit: values.unit,
        minStock: values.minStock,
      });
      message.success('Product updated');
      router.push(`/products/${id}`);
    } catch (error) {
      const fields = extractFieldErrors(error);
      if (fields) {
        setFieldErrors(fields);
        return;
      }
      message.error(errorText(error));
    }
  }

  return (
    <RequireCapability capability="product:update">
      <Flex vertical gap={16}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Edit product
        </Typography.Title>

        {productQuery.isLoading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        ) : productQuery.isError ? (
          <Result
            status={productQuery.error instanceof ApiError && productQuery.error.status === 404 ? '404' : 'error'}
            title="Product could not be loaded"
            subTitle={errorText(productQuery.error)}
            extra={
              <Button type="primary" onClick={() => router.push('/products')}>
                Back to products
              </Button>
            }
          />
        ) : productQuery.data ? (
          <>
            {!productQuery.data.isActive && (
              <Alert
                type="warning"
                showIcon
                message="This product is inactive"
                description="Edits are still allowed, but no stock can be received or requested for it."
              />
            )}
            <Card>
              <Flex gap={8} align="center" style={{ marginBottom: 16 }}>
                <Typography.Text strong>{productQuery.data.name}</Typography.Text>
                <Tag>{productQuery.data.isActive ? 'Active' : 'Inactive'}</Tag>
              </Flex>
              <ProductForm
                mode="edit"
                initial={productQuery.data}
                submitting={update.isPending}
                fieldErrors={fieldErrors}
                onSubmit={handleSubmit}
              />
            </Card>
          </>
        ) : null}
      </Flex>
    </RequireCapability>
  );
}
