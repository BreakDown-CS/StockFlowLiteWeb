'use client';

import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Input,
  Row,
  Segmented,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';

import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';
import { PAGE_SIZE_OPTIONS } from '@/lib/validation/list-params';

import { useInventoryReport } from '../hooks';
import type { InventoryItem } from '../types';
import { useInventoryReportParams } from '../use-inventory-report-params';

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/**
 * Inventory report.
 *
 * Low/out-of-stock flags come from the API (`is_low_stock`, `is_out_of_stock`) — the UI
 * never recomputes them, so the report and the backend can never disagree.
 */
export function InventoryReportScreen() {
  const { params, query, update } = useInventoryReportParams();
  const reportQuery = useInventoryReport(query);

  const summary = reportQuery.data?.report.summary;
  const items = reportQuery.data?.report.items ?? [];

  const columns: TableProps<InventoryItem>['columns'] = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 150 },
    { title: 'Product', dataIndex: 'name', key: 'name' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 90 },
    {
      title: 'On hand',
      key: 'stock',
      align: 'right',
      width: 110,
      render: (_, row) => row.currentStock,
    },
    { title: 'Minimum', dataIndex: 'minStock', key: 'min', align: 'right', width: 100 },
    {
      title: 'Flags',
      key: 'flags',
      width: 200,
      render: (_, row) => (
        <>
          {row.isOutOfStock && <Tag color="red">out of stock</Tag>}
          {!row.isOutOfStock && row.isLowStock && <Tag color="orange">low stock</Tag>}
          {!row.isActive && <Tag>inactive</Tag>}
          {row.isActive && !row.isLowStock && !row.isOutOfStock && (
            <Typography.Text type="secondary">ok</Typography.Text>
          )}
        </>
      ),
    },
    {
      title: 'Updated',
      key: 'updated',
      width: 180,
      render: (_, row) => new Date(row.updatedAt).toLocaleString(),
    },
  ];

  const limit = reportQuery.data?.meta?.limit ?? params.limit;
  const total = reportQuery.data?.meta?.total ?? items.length;

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={2}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Inventory report
        </Typography.Title>
        <Typography.Text type="secondary">
          Stock position per product. The summary always describes the filtered set.
        </Typography.Text>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Products" value={summary?.totalProducts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Active" value={summary?.activeProducts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Inactive" value={summary?.inactiveProducts ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic
              title="Low stock"
              value={summary?.lowStockProducts ?? 0}
              valueStyle={{ color: (summary?.lowStockProducts ?? 0) > 0 ? '#d4380d' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} lg={5}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic
              title="Out of stock"
              value={summary?.outOfStockProducts ?? 0}
              valueStyle={{
                color: (summary?.outOfStockProducts ?? 0) > 0 ? '#cf1322' : undefined,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Flex vertical gap={16}>
          <Flex wrap gap={12} align="center" justify="space-between">
            <Flex gap={12} wrap align="center">
              <Input.Search
                allowClear
                defaultValue={params.search}
                placeholder="Search SKU or name"
                style={{ width: 280 }}
                onSearch={(value) => update({ search: value.trim() })}
              />
              <Segmented
                value={params.isActive}
                options={[
                  { label: 'Active', value: 'true' },
                  { label: 'Inactive', value: 'false' },
                  { label: 'All', value: 'all' },
                ]}
                onChange={(next) => update({ isActive: next as 'true' | 'false' | 'all' })}
              />
              <Flex gap={8} align="center">
                <Switch
                  checked={params.lowStock}
                  onChange={(checked) => update({ lowStock: checked })}
                />
                <Typography.Text>Low stock only</Typography.Text>
              </Flex>
            </Flex>
            <Typography.Text type="secondary">Flags are computed by the API.</Typography.Text>
          </Flex>

          {reportQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load the inventory report"
              description={errorText(reportQuery.error)}
              action={
                <Button size="small" onClick={() => void reportQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <Table<InventoryItem>
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={items}
              loading={reportQuery.isLoading || reportQuery.isFetching}
              scroll={{ x: 'max-content' }}
              pagination={{
                current: Math.floor((reportQuery.data?.meta?.offset ?? 0) / limit) + 1,
                pageSize: limit,
                total,
                showSizeChanger: true,
                pageSizeOptions: [...PAGE_SIZE_OPTIONS],
                showTotal: (count) => `${count} products`,
                onChange: (page, pageSize) =>
                  update({ limit: pageSize, offset: (page - 1) * pageSize }),
              }}
              locale={{ emptyText: 'No products match these filters.' }}
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
