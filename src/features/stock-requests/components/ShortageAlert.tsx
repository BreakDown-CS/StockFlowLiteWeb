'use client';

import { Alert, Table, Typography } from 'antd';
import type { TableProps } from 'antd';

import type { Product } from '@/features/products/types';

import type { StockShortage } from '../types';

/**
 * Per-item shortage report.
 *
 * The API returns every unfulfillable line in `error.details.items` and deducts nothing —
 * showing only the first failure would misrepresent the situation.
 */
export function ShortageAlert({
  shortages,
  products,
}: {
  shortages: StockShortage[];
  products?: Map<string, Product>;
}) {
  const columns: TableProps<StockShortage>['columns'] = [
    {
      title: 'Product',
      key: 'product',
      render: (_, row) => {
        const product = products?.get(row.productId);
        return product ? (
          <span>
            {product.name}
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              {product.sku}
            </Typography.Text>
          </span>
        ) : (
          <Typography.Text code>{row.productId.slice(0, 8)}</Typography.Text>
        );
      },
    },
    { title: 'Requested', dataIndex: 'requested', key: 'requested', align: 'right', width: 110 },
    { title: 'Available', dataIndex: 'available', key: 'available', align: 'right', width: 110 },
    {
      title: 'Shortfall',
      dataIndex: 'shortfall',
      key: 'shortfall',
      align: 'right',
      width: 110,
      render: (value: number) => <Typography.Text type="danger">{value}</Typography.Text>,
    },
  ];

  return (
    <Alert
      type="error"
      showIcon
      message="Not enough stock to issue this request"
      description={
        <>
          <Typography.Paragraph style={{ marginTop: 8 }}>
            Nothing was deducted. Adjust the request or receive stock, then try again.
          </Typography.Paragraph>
          <Table<StockShortage>
            rowKey="productId"
            size="small"
            columns={columns}
            dataSource={shortages}
            pagination={false}
          />
        </>
      }
    />
  );
}
