'use client';

import Link from 'next/link';
import { Alert, Button, Card, Flex, Typography } from 'antd';

import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useRequests } from '../hooks';
import { useRequestListParams } from '../use-request-params';
import { RequestFilters } from './RequestFilters';
import { RequestTable } from './RequestTable';

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/** Stock request list. */
export function RequestsScreen() {
  const { params, query, update } = useRequestListParams();
  const requestsQuery = useRequests(query);

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Stock requests
          </Typography.Title>
          <Typography.Text type="secondary">
            Requests move through approval and issuance. Stock changes only when a request
            is issued.
          </Typography.Text>
        </Flex>
        <Link href="/stock-requests/new">
          <Button type="primary">New request</Button>
        </Link>
      </Flex>

      <Card>
        <Flex vertical gap={16}>
          <RequestFilters status={params.status} onChange={(status) => update({ status })} />

          {requestsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load requests"
              description={errorText(requestsQuery.error)}
              action={
                <Button size="small" onClick={() => void requestsQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <RequestTable
              items={requestsQuery.data?.items ?? []}
              meta={requestsQuery.data?.meta}
              loading={requestsQuery.isLoading || requestsQuery.isFetching}
              onPageChange={(page, pageSize) =>
                update({ limit: pageSize, offset: (page - 1) * pageSize })
              }
            />
          )}
        </Flex>
      </Card>
    </Flex>
  );
}
