'use client';

import Link from 'next/link';
import { Button, Table, Typography } from 'antd';
import type { TableProps } from 'antd';

import type { PageMeta } from '@/lib/api/envelope';
import { PAGE_SIZE_OPTIONS } from '@/lib/validation/list-params';

import type { StockRequest } from '../types';
import { RequestStatusTag } from './RequestStatusTag';

/** Request list table. Rows link to the detail screen where the workflow lives. */
export function RequestTable({
  items,
  meta,
  loading,
  onPageChange,
}: {
  items: StockRequest[];
  meta?: PageMeta;
  loading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
}) {
  const columns: TableProps<StockRequest>['columns'] = [
    {
      title: 'Number',
      dataIndex: 'requestNumber',
      key: 'number',
      width: 200,
      render: (value: string, row) => (
        <Link href={`/stock-requests/${row.id}`}>
          <Typography.Link>{value}</Typography.Link>
        </Link>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: StockRequest['status']) => <RequestStatusTag status={status} />,
    },
    {
      title: 'Items',
      key: 'items',
      align: 'right',
      width: 90,
      render: (_, row) => row.items.length,
    },
    {
      title: 'Units requested',
      key: 'units',
      align: 'right',
      width: 150,
      render: (_, row) => row.items.reduce((total, item) => total + item.requestedQuantity, 0),
    },
    {
      title: 'Created',
      key: 'created',
      width: 190,
      render: (_, row) => new Date(row.createdAt).toLocaleString(),
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
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, row) => (
        <Link href={`/stock-requests/${row.id}`}>
          <Button size="small">Open</Button>
        </Link>
      ),
    },
  ];

  const limit = meta?.limit ?? 20;
  const total = meta?.total ?? items.length;

  return (
    <Table<StockRequest>
      rowKey="id"
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
        showTotal: (count) => `${count} requests`,
        onChange: onPageChange,
      }}
      locale={{ emptyText: 'No requests match this filter.' }}
    />
  );
}
