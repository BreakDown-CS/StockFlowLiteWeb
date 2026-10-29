'use client';

import { Table, Tag, Tooltip, Typography } from 'antd';
import type { TableProps } from 'antd';

import type { PageMeta } from '@/lib/api/envelope';
import { PAGE_SIZE_OPTIONS } from '@/lib/validation/list-params';

import type { MovementType, StockMovement } from '../types';

const TYPE_COLOR: Record<MovementType, string> = {
  RECEIPT: 'green',
  ISSUE: 'volcano',
  ADJUSTMENT: 'blue',
};

/** Ledger table. Rows are immutable history, so there are no row actions. */
export function MovementTable({
  items,
  meta,
  loading,
  onPageChange,
}: {
  items: StockMovement[];
  meta?: PageMeta;
  loading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
}) {
  const columns: TableProps<StockMovement>['columns'] = [
    {
      title: 'When',
      key: 'createdAt',
      width: 190,
      render: (_, row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, row) => (
        <div>
          <Typography.Text>{row.productName}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.sku}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'movementType',
      key: 'type',
      width: 130,
      render: (type: MovementType) => <Tag color={TYPE_COLOR[type]}>{type}</Tag>,
    },
    {
      title: 'Quantity',
      key: 'signed',
      align: 'right',
      width: 110,
      render: (_, row) => (
        <Typography.Text
          strong
          style={{ color: row.signedQuantity < 0 ? '#cf1322' : '#389e0d' }}
        >
          {row.signedQuantity > 0 ? `+${row.signedQuantity}` : row.signedQuantity}
        </Typography.Text>
      ),
    },
    {
      title: 'Reference',
      key: 'reference',
      width: 200,
      render: (_, row) => (
        <Tooltip title={row.referenceId || 'no reference id'}>
          <Typography.Text type="secondary">
            {row.referenceType}
            {row.referenceId ? ` · ${row.referenceId.slice(0, 8)}` : ''}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: 'Notes',
      key: 'notes',
      render: (_, row) =>
        row.notes ? (
          <Typography.Text>{row.notes}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

  const limit = meta?.limit ?? 20;
  const total = meta?.total ?? items.length;

  return (
    <Table<StockMovement>
      rowKey={(row) => String(row.id)}
      size="middle"
      columns={columns}
      dataSource={items}
      loading={loading}
      scroll={{ x: 'max-content' }}
      pagination={{
        current: Math.floor((meta?.offset ?? 0) / limit) + 1,
        pageSize: limit,
        total,
        showSizeChanger: true,
        pageSizeOptions: [...PAGE_SIZE_OPTIONS],
        showTotal: (count) => `${count} movements`,
        onChange: onPageChange,
      }}
      locale={{ emptyText: 'No movements match these filters.' }}
    />
  );
}
