'use client';

import Link from 'next/link';
import { Button, Space, Table, Tag } from 'antd';
import type { TableProps } from 'antd';

import { useCan } from '@/features/auth/session-context';
import type { PageMeta } from '@/lib/api/envelope';
import { PAGE_SIZE_OPTIONS } from '@/lib/validation/list-params';

import type { Product } from '../types';
import { DeactivateProductButton } from './DeactivateProductButton';

type ProductTableProps = {
  items: Product[];
  meta?: PageMeta;
  loading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onDeactivate: (product: Product) => Promise<void>;
};

/**
 * Product table.
 *
 * No column sorters: the API exposes no sort parameters, so a sorter could only reorder
 * the current page — which would be misleading.
 */
export function ProductTable({
  items,
  meta,
  loading,
  onPageChange,
  onDeactivate,
}: ProductTableProps) {
  const can = useCan();
  const canEdit = can('product:update');
  const canDeactivate = can('product:deactivate');

  const columns: TableProps<Product>['columns'] = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 150 },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 90 },
    {
      title: 'On hand',
      key: 'stock',
      align: 'right',
      width: 110,
      render: (_, row) => row.currentStock,
    },
    {
      title: 'Minimum',
      dataIndex: 'minStock',
      key: 'min',
      align: 'right',
      width: 100,
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, row) =>
        row.isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: 'Updated',
      key: 'updated',
      width: 180,
      render: (_, row) => new Date(row.updatedAt).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_, row) => (
        <Space size={8} wrap>
          <Link href={`/products/${row.id}`}>
            <Button size="small">View</Button>
          </Link>
          {canEdit && (
            <Link href={`/products/${row.id}/edit`}>
              <Button size="small">Edit</Button>
            </Link>
          )}
          {canDeactivate && row.isActive && (
            <DeactivateProductButton product={row} onConfirm={onDeactivate} />
          )}
        </Space>
      ),
    },
  ];

  const limit = meta?.limit ?? 20;
  const total = meta?.total ?? items.length;

  return (
    <Table<Product>
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
        showTotal: (count) => `${count} products`,
        onChange: (page, pageSize) => onPageChange(page, pageSize),
      }}
      locale={{ emptyText: 'No products match this filter.' }}
    />
  );
}
