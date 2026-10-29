'use client';

import { Card, Flex, Typography } from 'antd';

import { RequireCapability } from '@/components/RequireCapability';

import { ReceiptForm } from './ReceiptForm';

/** Receive-stock screen (storekeeper/admin only). */
export function ReceiptScreen() {
  return (
    <RequireCapability capability="receipt:create">
      <Flex vertical gap={16}>
        <Flex vertical gap={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Receive stock
          </Typography.Title>
          <Typography.Text type="secondary">
            Record an inbound delivery. Balances change only here and through request
            issuance — never through the product form.
          </Typography.Text>
        </Flex>

        <Card style={{ maxWidth: 720 }}>
          <ReceiptForm />
        </Card>
      </Flex>
    </RequireCapability>
  );
}
