'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Flex, Form, Input, InputNumber, Typography } from 'antd';

import { ProductSelect } from '@/features/products/components/ProductSelect';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useCreateReceipt } from '../hooks';
import type { ReceiptResult } from '../types';

type ReceiptFormValues = {
  productId: string;
  quantity: number;
  notes?: string;
};

/**
 * Receive stock form.
 *
 * The error panel is deliberately persistent rather than a toast: `PRODUCT_INACTIVE` and
 * `STOCK_OVERFLOW` are states the user has to understand and fix, not transient noise.
 */
export function ReceiptForm() {
  const [form] = Form.useForm<ReceiptFormValues>();
  const { message } = App.useApp();
  const create = useCreateReceipt();

  const [result, setResult] = useState<ReceiptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish(values: ReceiptFormValues): Promise<void> {
    setError(null);
    setResult(null);

    try {
      const outcome = await create.mutateAsync({
        productId: values.productId,
        quantity: values.quantity,
        notes: values.notes,
      });
      setResult(outcome);
      message.success('Stock received');
      form.resetFields();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : 'INTERNAL_ERROR';
      setError(messageForCode(code));
    }
  }

  return (
    <Form<ReceiptFormValues> form={form} layout="vertical" requiredMark="optional" onFinish={handleFinish}>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Could not receive stock"
          description={error}
        />
      )}

      {result && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Received ${result.quantity} ${result.product.unit}`}
          description={
            <>
              {result.product.name} ({result.product.sku}) now holds{' '}
              <strong>
                {result.product.currentStock} {result.product.unit}
              </strong>
              . Ledger entry #{result.movementId}.
            </>
          }
          action={
            <Link href="/stock-movements">
              <Button size="small">View ledger</Button>
            </Link>
          }
        />
      )}

      <Form.Item
        name="productId"
        label="Product"
        rules={[{ required: true, message: 'Select a product' }]}
        extra="Only active products can receive stock."
      >
        <ProductSelect activeOnly style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        name="quantity"
        label="Quantity received"
        rules={[{ required: true, message: 'Enter the quantity received' }]}
      >
        <InputNumber
          min={1}
          max={2_147_483_647}
          precision={0}
          style={{ width: 200 }}
          placeholder="e.g. 24"
        />
      </Form.Item>

      <Form.Item
        name="notes"
        label="Notes"
        rules={[{ max: 1000, message: 'Notes must not exceed 1000 characters' }]}
      >
        <Input.TextArea rows={3} maxLength={1000} showCount placeholder="Delivery reference, supplier, …" />
      </Form.Item>

      <Flex gap={8}>
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          Receive stock
        </Button>
        <Link href="/stock-movements">
          <Button htmlType="button">Cancel</Button>
        </Link>
      </Flex>

      <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
        A receipt increments the product balance and appends exactly one RECEIPT movement,
        in a single transaction on the server.
      </Typography.Paragraph>
    </Form>
  );
}
