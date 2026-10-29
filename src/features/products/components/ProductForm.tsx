'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Flex, Form, Input, InputNumber, Space, Typography } from 'antd';

import type { Product } from '../types';

export type ProductFormValues = {
  sku: string;
  name: string;
  unit: string;
  description?: string;
  minStock?: number;
};

type ProductFormProps = {
  mode: 'create' | 'edit';
  initial?: Product;
  submitting: boolean;
  /** Field-level errors returned by the BFF (`details.fields`). */
  fieldErrors?: Record<string, string>;
  onSubmit: (values: ProductFormValues) => void;
};

/**
 * Shared product form.
 *
 * Rules mirror the API (`product_handler.go`), so most invalid input never leaves the
 * browser. On the edit screen the SKU is read-only because the API's update contract has
 * no `sku` field at all — presenting it as editable would be a lie.
 */
export function ProductForm({ mode, initial, submitting, fieldErrors, onSubmit }: ProductFormProps) {
  const [form] = Form.useForm<ProductFormValues>();

  useEffect(() => {
    if (!fieldErrors) {
      return;
    }
    const entries = Object.entries(fieldErrors).map(([name, error]) => ({
      name: name as keyof ProductFormValues,
      errors: [error],
    }));
    if (entries.length > 0) {
      form.setFields(entries);
    }
  }, [fieldErrors, form]);

  return (
    <Form<ProductFormValues>
      form={form}
      layout="vertical"
      requiredMark="optional"
      onFinish={onSubmit}
      initialValues={{
        sku: initial?.sku ?? '',
        name: initial?.name ?? '',
        unit: initial?.unit ?? 'PCS',
        description: initial?.description ?? '',
        minStock: initial?.minStock ?? 0,
      }}
    >
      <Form.Item
        name="sku"
        label="SKU"
        tooltip={mode === 'edit' ? 'The SKU cannot be changed after creation.' : undefined}
        rules={
          mode === 'create'
            ? [
                { required: true, message: 'SKU is required' },
                { max: 50, message: 'SKU must not exceed 50 characters' },
              ]
            : undefined
        }
      >
        <Input
          disabled={mode === 'edit'}
          maxLength={50}
          placeholder="e.g. SKU-1001"
          autoComplete="off"
        />
      </Form.Item>

      <Form.Item
        name="name"
        label="Name"
        rules={[
          { required: true, message: 'Product name is required' },
          { max: 200, message: 'Product name must not exceed 200 characters' },
        ]}
      >
        <Input maxLength={200} placeholder="e.g. Nitrile gloves" autoComplete="off" />
      </Form.Item>

      <Space size={16} align="start" wrap>
        <Form.Item
          name="unit"
          label="Unit"
          style={{ minWidth: 160 }}
          rules={[{ max: 20, message: 'Unit must not exceed 20 characters' }]}
        >
          <Input maxLength={20} placeholder="PCS" />
        </Form.Item>

        <Form.Item name="minStock" label="Minimum stock" style={{ minWidth: 160 }}>
          <InputNumber
            min={0}
            max={2_147_483_647}
            precision={0}
            style={{ width: '100%' }}
            placeholder="0"
          />
        </Form.Item>
      </Space>

      <Form.Item
        name="description"
        label="Description"
        rules={[{ max: 1000, message: 'Description must not exceed 1000 characters' }]}
      >
        <Input.TextArea rows={3} maxLength={1000} showCount placeholder="Optional notes" />
      </Form.Item>

      <Flex gap={8}>
        <Button type="primary" htmlType="submit" loading={submitting}>
          {mode === 'create' ? 'Create product' : 'Save changes'}
        </Button>
        <Link href={initial ? `/products/${initial.id}` : '/products'}>
          <Button htmlType="button">Cancel</Button>
        </Link>
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
        Stock levels change only through receipts and issues, never through this form.
      </Typography.Paragraph>
    </Form>
  );
}
