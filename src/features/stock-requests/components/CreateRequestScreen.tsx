'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  App,
  Button,
  Card,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Typography,
} from 'antd';

import { ProductSelect } from '@/features/products/components/ProductSelect';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useCreateRequest } from '../hooks';

type ItemRow = { productId?: string; quantity?: number };
type FormValues = { items: ItemRow[]; notes?: string };

/**
 * New request form.
 *
 * Line items are added/removed dynamically; duplicates are rejected here (the API rejects
 * them too) so the user gets an inline error instead of a failed round trip.
 */
export function CreateRequestScreen() {
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const create = useCreateRequest();

  async function handleFinish(values: FormValues): Promise<void> {
    const items = values.items
      .filter((item): item is { productId: string; quantity: number } =>
        Boolean(item.productId) && typeof item.quantity === 'number',
      )
      .map((item) => ({ productId: item.productId, quantity: item.quantity }));

    try {
      const created = await create.mutateAsync({ items, notes: values.notes });
      message.success(`Request ${created.requestNumber} submitted`);
      router.push(`/stock-requests/${created.id}`);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : 'INTERNAL_ERROR';
      message.error(messageForCode(code));
    }
  }

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={2}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          New stock request
        </Typography.Title>
        <Typography.Text type="secondary">
          Requests start as PENDING. Nothing is deducted until the request is approved and
          then issued.
        </Typography.Text>
      </Flex>

      <Card style={{ maxWidth: 860 }}>
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark="optional"
          initialValues={{ items: [{ quantity: 1 }] }}
          onFinish={handleFinish}
        >
          <Form.List
            name="items"
            rules={[
              {
                validator: async (_, rows: ItemRow[] | undefined) => {
                  const ids = (rows ?? []).map((row) => row.productId).filter(Boolean);
                  if (ids.length > 0 && new Set(ids).size !== ids.length) {
                    throw new Error('The same product appears more than once');
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <Flex vertical gap={8}>
                {fields.map((field) => (
                  <Flex key={field.key} gap={8} align="flex-start" wrap>
                    <Form.Item
                      {...field}
                      name={[field.name, 'productId']}
                      label={field.name === 0 ? 'Product' : undefined}
                      rules={[{ required: true, message: 'Select a product' }]}
                      style={{ flex: '1 1 320px', marginBottom: 8 }}
                    >
                      <ProductSelect />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      name={[field.name, 'quantity']}
                      label={field.name === 0 ? 'Quantity' : undefined}
                      rules={[{ required: true, message: 'Enter a quantity' }]}
                      style={{ marginBottom: 8 }}
                    >
                      <InputNumber min={1} max={2_147_483_647} precision={0} style={{ width: 140 }} />
                    </Form.Item>

                    <Button
                      danger
                      disabled={fields.length === 1}
                      style={{ marginTop: field.name === 0 ? 30 : 0 }}
                      onClick={() => remove(field.name)}
                    >
                      Remove
                    </Button>
                  </Flex>
                ))}

                <div>
                  <Button onClick={() => add({ quantity: 1 })}>Add item</Button>
                </div>
                <Form.ErrorList errors={errors} />
              </Flex>
            )}
          </Form.List>

          <Divider />

          <Form.Item
            name="notes"
            label="Notes"
            rules={[{ max: 1000, message: 'Notes must not exceed 1000 characters' }]}
          >
            <Input.TextArea rows={3} maxLength={1000} showCount placeholder="Why is this needed?" />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="A request is not a reservation"
            description="Stock is only deducted at issuance, and issuance is all-or-nothing: if any line is short, nothing is deducted."
          />

          <Flex gap={8}>
            <Button type="primary" htmlType="submit" loading={create.isPending}>
              Submit request
            </Button>
            <Link href="/stock-requests">
              <Button htmlType="button">Cancel</Button>
            </Link>
          </Flex>
        </Form>
      </Card>
    </Flex>
  );
}
