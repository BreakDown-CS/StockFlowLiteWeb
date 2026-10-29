'use client';

import Link from 'next/link';
import { Alert, Button, Card, Descriptions, Flex, Result, Skeleton, Table, Typography } from 'antd';
import type { TableProps } from 'antd';

import { useSession } from '@/features/auth/session-context';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useRequest } from '../hooks';
import type { StockRequestItem } from '../types';
import { useProductLookup } from '../use-product-lookup';
import { RequestActions } from './RequestActions';
import { RequestStatusTag } from './RequestStatusTag';

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/** Request detail: line items, review metadata and the workflow actions. */
export function RequestDetailScreen({ id }: { id: string }) {
  const { user } = useSession();
  const requestQuery = useRequest(id);
  const request = requestQuery.data;

  const { byId, truncated } = useProductLookup(request?.items.map((item) => item.productId) ?? []);

  const columns: TableProps<StockRequestItem>['columns'] = [
    {
      title: 'Product',
      key: 'product',
      render: (_, row) => {
        const product = byId.get(row.productId);
        if (!product) {
          return <Typography.Text code>{row.productId.slice(0, 8)}…</Typography.Text>;
        }
        return (
          <span>
            {product.name}
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              {product.sku}
            </Typography.Text>
          </span>
        );
      },
    },
    {
      title: 'Requested',
      dataIndex: 'requestedQuantity',
      key: 'requested',
      align: 'right',
      width: 120,
    },
    {
      title: 'On hand',
      key: 'stock',
      align: 'right',
      width: 120,
      render: (_, row) => {
        const product = byId.get(row.productId);
        if (!product) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        const short = product.currentStock < row.requestedQuantity;
        return (
          <Typography.Text type={short ? 'danger' : undefined}>
            {product.currentStock}
          </Typography.Text>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: 160,
      render: (_, row) => {
        const product = byId.get(row.productId);
        if (!product) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        if (!product.isActive) {
          return <Typography.Text type="warning">inactive</Typography.Text>;
        }
        return product.currentStock >= row.requestedQuantity ? (
          <Typography.Text type="success">fulfillable</Typography.Text>
        ) : (
          <Typography.Text type="danger">short</Typography.Text>
        );
      },
    },
  ];

  if (requestQuery.isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  if (requestQuery.isError) {
    const notFound = requestQuery.error instanceof ApiError && requestQuery.error.status === 404;
    return (
      <Result
        status={notFound ? '404' : 'error'}
        title={notFound ? 'Request not found' : 'Request could not be loaded'}
        subTitle={
          notFound
            ? 'It may not exist, or it belongs to another requester — the API deliberately returns the same answer for both.'
            : errorText(requestQuery.error)
        }
        extra={
          <Link href="/stock-requests">
            <Button type="primary">Back to requests</Button>
          </Link>
        }
      />
    );
  }

  if (!request) {
    return null;
  }

  const isOwnRequest = request.requesterId === user.id;

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={4}>
          <Flex gap={8} align="center" wrap>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {request.requestNumber}
            </Typography.Title>
            <RequestStatusTag status={request.status} />
          </Flex>
          <Typography.Text type="secondary">
            Created {new Date(request.createdAt).toLocaleString()} ·{' '}
            {request.items.length} line(s) ·{' '}
            {request.items.reduce((total, item) => total + item.requestedQuantity, 0)} unit(s)
          </Typography.Text>
        </Flex>
        <Link href="/stock-requests">
          <Button>Back</Button>
        </Link>
      </Flex>

      {truncated && (
        <Alert
          type="info"
          showIcon
          message="Some product names were not resolved"
          description="This request references more than 20 distinct products; the remaining lines show their identifier only."
        />
      )}

      <Card title="Actions">
        <RequestActions request={request} products={byId} />
      </Card>

      <Card title="Items">
        <Table<StockRequestItem>
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={request.items}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'This request has no items.' }}
        />
      </Card>

      <Card title="Details">
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: 'requester',
              label: 'Requester',
              children: isOwnRequest ? (
                <span>
                  you <Typography.Text code>{request.requesterId.slice(0, 8)}</Typography.Text>
                </span>
              ) : (
                <Typography.Text code>{request.requesterId}</Typography.Text>
              ),
            },
            {
              key: 'notes',
              label: 'Notes',
              children: request.notes || <Typography.Text type="secondary">—</Typography.Text>,
            },
            {
              key: 'reviewer',
              label: 'Reviewer',
              children: request.reviewerId ? (
                <Typography.Text code>{request.reviewerId}</Typography.Text>
              ) : (
                <Typography.Text type="secondary">not reviewed</Typography.Text>
              ),
            },
            {
              key: 'reviewed',
              label: 'Reviewed at',
              children: request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : '—',
            },
            {
              key: 'rejection',
              label: 'Rejection reason',
              children:
                request.rejectionReason || <Typography.Text type="secondary">—</Typography.Text>,
            },
            {
              key: 'updated',
              label: 'Last updated',
              children: new Date(request.updatedAt).toLocaleString(),
            },
            {
              key: 'issuance',
              label: 'Issuance',
              children: request.issuance ? (
                <span>
                  {request.issuance.totalQuantity} unit(s) across {request.issuance.itemCount}{' '}
                  line(s), issued {new Date(request.issuance.createdAt).toLocaleString()}
                </span>
              ) : (
                <Typography.Text type="secondary">not issued</Typography.Text>
              ),
            },
          ]}
        />
      </Card>
    </Flex>
  );
}
