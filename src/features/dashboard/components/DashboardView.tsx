'use client';

import { Alert, Button, Card, Col, Flex, Row, Space, Statistic, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';

import { useCan, useSession } from '@/features/auth/session-context';
import { useInventoryReport } from '@/features/reports/hooks';
import type { InventoryItem } from '@/features/reports/types';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

/**
 * Dashboard.
 *
 * Two API calls on purpose: the inventory summary describes the FILTERED set, so the
 * counters come from an unfiltered request while the table comes from
 * `low_stock=true`. "Low stock" cannot be derived client-side from `/products` — that
 * endpoint exposes neither the flags nor a low-stock filter.
 */

function errorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  return messageForCode(code);
}

const columns: TableProps<InventoryItem>['columns'] = [
  { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 140 },
  { title: 'Product', dataIndex: 'name', key: 'name' },
  {
    title: 'On hand',
    key: 'stock',
    align: 'right',
    width: 120,
    render: (_, row) => `${row.currentStock} ${row.unit}`,
  },
  { title: 'Minimum', dataIndex: 'minStock', key: 'min', align: 'right', width: 100 },
  {
    title: 'Status',
    key: 'status',
    width: 130,
    render: (_, row) =>
      row.isOutOfStock ? <Tag color="red">Out of stock</Tag> : <Tag color="orange">Low stock</Tag>,
  },
  {
    title: 'Updated',
    key: 'updated',
    width: 180,
    render: (_, row) => new Date(row.updatedAt).toLocaleString(),
  },
];

export function DashboardView() {
  const { user } = useSession();
  const can = useCan();

  const summaryQuery = useInventoryReport({ isActive: 'all', limit: 1 });
  const lowStockQuery = useInventoryReport({ lowStock: true, limit: 8 });

  const summary = summaryQuery.data?.report.summary;
  const lowStockItems = lowStockQuery.data?.report.items ?? [];
  const lowStockTotal = lowStockQuery.data?.meta?.total;

  return (
    <>
      <Flex vertical gap={2}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Dashboard
        </Typography.Title>
        <Typography.Text type="secondary">
          Inventory position and items at or below their minimum level. Signed in as{' '}
          {user.username} ({user.role}).
        </Typography.Text>
      </Flex>

      {summaryQuery.isError && (
        <Alert
          type="error"
          showIcon
          message="Could not load the inventory summary"
          description={errorText(summaryQuery.error)}
          action={
            <Button size="small" onClick={() => void summaryQuery.refetch()}>
              Retry
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small" loading={summaryQuery.isLoading}>
            <Statistic title="Products" value={summary?.totalProducts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" loading={summaryQuery.isLoading}>
            <Statistic title="Active" value={summary?.activeProducts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <Card size="small" loading={summaryQuery.isLoading}>
            <Statistic title="Inactive" value={summary?.inactiveProducts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card size="small" loading={summaryQuery.isLoading}>
            <Statistic
              title="Low stock"
              value={summary?.lowStockProducts ?? 0}
              valueStyle={{ color: (summary?.lowStockProducts ?? 0) > 0 ? '#d4380d' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={5}>
          <Card size="small" loading={summaryQuery.isLoading}>
            <Statistic
              title="Out of stock"
              value={summary?.outOfStockProducts ?? 0}
              valueStyle={{ color: (summary?.outOfStockProducts ?? 0) > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Low stock"
        extra={
          lowStockTotal !== undefined ? (
            <Typography.Text type="secondary">
              showing {lowStockItems.length} of {lowStockTotal}
            </Typography.Text>
          ) : null
        }
      >
        {lowStockQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Could not load low-stock items"
            description={errorText(lowStockQuery.error)}
            action={
              <Button size="small" onClick={() => void lowStockQuery.refetch()}>
                Retry
              </Button>
            }
          />
        ) : (
          <Table<InventoryItem>
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={lowStockItems}
            loading={lowStockQuery.isLoading}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'Every active product is above its minimum level.' }}
          />
        )}
      </Card>

      <Card title="What you can do next">
        <Space wrap>
          <Button disabled title="Products screen arrives in Phase F3">
            Products
          </Button>
          <Button disabled={!can('receipt:create')} title="Receiving arrives in Phase F4">
            Receive stock
          </Button>
          <Button disabled={!can('request:create')} title="Stock requests arrive in Phase F5">
            New stock request
          </Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Button availability follows your role, and the API enforces the same rules
          independently. Screens are enabled as their phase ships.
        </Typography.Paragraph>
      </Card>
    </>
  );
}
