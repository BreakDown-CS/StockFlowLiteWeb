'use client';

import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TableProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { useCan } from '@/features/auth/session-context';
import { REQUEST_STATUSES, type RequestStatus } from '@/features/stock-requests/types';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';
import { PAGE_SIZE_OPTIONS } from '@/lib/validation/list-params';
import { dayBoundsToInstants } from '@/lib/validation/report-range';

import { useRequestReport } from '../hooks';
import type { RequestReportRow } from '../types';
import { useRequestReportParams } from '../use-request-report-params';

const { RangePicker } = DatePicker;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'gold',
  APPROVED: 'blue',
  REJECTED: 'red',
  ISSUED: 'green',
  CANCELLED: 'default',
};

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/**
 * Request report with fulfilment aggregates.
 *
 * The date range defaults to the last 30 days because the API has no default window;
 * "All time" is an explicit, visible choice. The requester filter is not shown: a requester
 * is always scoped to their own rows by the API, and listing users needs the admin screens.
 */
export function RequestReportScreen() {
  const can = useCan();
  const { params, range, query, update, clearRange, useLast30Days } = useRequestReportParams();
  const reportQuery = useRequestReport(query);

  const summary = reportQuery.data?.report.summary;
  const items = reportQuery.data?.report.items ?? [];

  const selectedRange: [Dayjs, Dayjs] | null =
    range.mode === 'custom' && range.from && range.to
      ? [dayjs(range.from), dayjs(range.to)]
      : null;

  const columns: TableProps<RequestReportRow>['columns'] = [
    { title: 'Number', dataIndex: 'requestNumber', key: 'number', width: 200 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
    },
    { title: 'Requester', dataIndex: 'requesterUsername', key: 'requester', width: 150 },
    { title: 'Lines', dataIndex: 'itemCount', key: 'lines', align: 'right', width: 90 },
    {
      title: 'Requested',
      dataIndex: 'requestedUnits',
      key: 'requested',
      align: 'right',
      width: 120,
    },
    {
      title: 'Issued',
      dataIndex: 'issuedUnits',
      key: 'issued',
      align: 'right',
      width: 110,
    },
    {
      title: 'Created',
      key: 'created',
      width: 180,
      render: (_, row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      title: 'Reviewed / issued',
      key: 'reviewed',
      width: 200,
      render: (_, row) => {
        if (row.issuedAt) {
          return `issued ${new Date(row.issuedAt).toLocaleString()}`;
        }
        if (row.reviewedAt) {
          return `reviewed ${new Date(row.reviewedAt).toLocaleString()}`;
        }
        return <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    {
      title: 'Reason',
      key: 'reason',
      render: (_, row) =>
        row.rejectionReason || row.cancellationReason || (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

  const limit = reportQuery.data?.meta?.limit ?? params.limit;
  const total = reportQuery.data?.meta?.total ?? items.length;

  return (
    <Flex vertical gap={16}>
      <Flex vertical gap={2}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Request report
        </Typography.Title>
        <Typography.Text type="secondary">
          Requests with fulfilment totals for the selected window.
          {can('request:read:any')
            ? ' You see every requester.'
            : ' You only see your own requests — the API scopes this for you.'}
        </Typography.Text>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Requests" value={summary?.totalRequests ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic
              title="Pending"
              value={summary?.pendingRequests ?? 0}
              valueStyle={{ color: (summary?.pendingRequests ?? 0) > 0 ? '#d48806' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Issued" value={summary?.issuedRequests ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Rejected" value={summary?.rejectedRequests ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Units requested" value={summary?.requestedUnitsTotal ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Units issued" value={summary?.issuedUnitsTotal ?? 0} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Flex vertical gap={16}>
          <Flex wrap gap={12} align="center" justify="space-between">
            <Flex gap={12} wrap align="center">
              <Select<RequestStatus>
                allowClear
                value={params.status}
                placeholder="All statuses"
                style={{ width: 170 }}
                onChange={(status) => update({ status })}
                options={REQUEST_STATUSES.map((value) => ({ value, label: value }))}
              />

              <RangePicker
                value={selectedRange}
                onChange={(dates) => {
                  const start = dates?.[0];
                  const end = dates?.[1];
                  if (!start || !end) {
                    return;
                  }
                  update(dayBoundsToInstants(start.toDate(), end.toDate()));
                }}
              />

              <Space size={8}>
                <Button size="small" onClick={useLast30Days} disabled={range.mode === 'default'}>
                  Last 30 days
                </Button>
                <Button size="small" onClick={clearRange} disabled={range.mode === 'all'}>
                  All time
                </Button>
              </Space>
            </Flex>

            <Typography.Text type="secondary">
              {range.mode === 'default'
                ? 'Showing the last 30 days (the API applies no default).'
                : range.mode === 'all'
                  ? 'Showing all time — the full history.'
                  : 'Showing a custom range.'}
            </Typography.Text>
          </Flex>

          {reportQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load the request report"
              description={errorText(reportQuery.error)}
              action={
                <Button size="small" onClick={() => void reportQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <Table<RequestReportRow>
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
                showTotal: (count) => `${count} requests`,
                onChange: (page, pageSize) =>
                  update({ limit: pageSize, offset: (page - 1) * pageSize }),
              }}
              locale={{ emptyText: 'No requests in this window.' }}
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
