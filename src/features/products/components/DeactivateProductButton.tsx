'use client';

import { useState } from 'react';
import { App, Button, Typography } from 'antd';

import type { Product } from '@/features/products/types';

/**
 * Deactivation is irreversible: the API has no activate endpoint, so this confirms with
 * explicit copy instead of a generic "Are you sure?".
 */
export function DeactivateProductButton({
  product,
  onConfirm,
  size = 'small',
}: {
  product: Product;
  onConfirm: (product: Product) => Promise<void>;
  size?: 'small' | 'middle';
}) {
  const { modal, message } = App.useApp();
  const [working, setWorking] = useState(false);

  function confirm(): void {
    modal.confirm({
      title: `Deactivate ${product.sku}?`,
      okText: 'Deactivate',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      content: (
        <>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            <strong>{product.name}</strong> will no longer appear in product lists, and no
            stock can be received or requested for it.
          </Typography.Paragraph>
          <Typography.Paragraph type="danger" style={{ marginBottom: 0 }}>
            This cannot be undone from the application: the API has no reactivate
            endpoint.
          </Typography.Paragraph>
        </>
      ),
      onOk: async () => {
        setWorking(true);
        try {
          await onConfirm(product);
          message.success(`${product.sku} deactivated`);
        } finally {
          setWorking(false);
        }
      },
    });
  }

  return (
    <Button size={size} danger loading={working} onClick={confirm}>
      Deactivate
    </Button>
  );
}
