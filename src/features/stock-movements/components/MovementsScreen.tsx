'use client';

import Link from 'next/link';
import { Alert, Button, Card, Col, Flex, Row, Statistic, Typography } from 'antd';

import { useCan } from '@/features/auth/session-context';
import { ApiError } from '@/lib/api/errors';
import { messageForCode } from '@/lib/api/messages';

import { useMovementReport } from '../hooks';
import { useMovementListParams } from '../use-movement-params';
import { MovementFilters } from './MovementFilters';
import { MovementTable } from './MovementTable';

function errorText(error: unknown): string {
  return messageForCode(error instanceof ApiError ? error.code : 'INTERNAL_ERROR');
}

/**
 * Stock movement ledger.
 *
 * Data comes from `/reports/stock-movements`, which is the only endpoint that returns the
 * product identity and a signed quantity alongside each movement.
 */
export function MovementsScreen() {
  const can = useCan();
  const { params, query, rangeInvalid, update } = useMovementListParams();

  const reportQuery = useMovementReport(query, !rangeInvalid);
  const summary = reportQuery.data?.report.summary;

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <Flex vertical gap={2}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Stock movements
          </Typography.Title>
          <Typography.Text type="secondary">
            Immutable ledger of every receipt and issue, newest first.
          </Typography.Text>
        </Flex>
        {can('receipt:create') && (
          <Link href="/stock-receipts/new">
            <Button type="primary">Receive stock</Button>
          </Link>
        )}
      </Flex>

      {rangeInvalid && (
        <Alert
          type="error"
          showIcon
          message="The date range is invalid"
          description="The start date must be on or before the end date. Clear the filters to continue."
          action={
            <Button size="small" onClick={() => update({ from: undefined, to: undefined })}>
              Clear dates
            </Button>
          }
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Movements" value={summary?.movementCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Received" value={summary?.receiptTotalQuantity ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic title="Issued" value={summary?.issueTotalQuantity ?? 0} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" loading={reportQuery.isLoading}>
            <Statistic
              title="Net change"
              value={summary?.netChange ?? 0}
              valueStyle={{
                color:
                  (summary?.netChange ?? 0) < 0
                    ? '#cf1322'
                    : (summary?.netChange ?? 0) > 0
                      ? '#389e0d'
                      : undefined,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Flex vertical gap={16}>
          <MovementFilters params={params} onChange={update} />

          {reportQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="Could not load the ledger"
              description={errorText(reportQuery.error)}
              action={
                <Button size="small" onClick={() => void reportQuery.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <MovementTable
              items={reportQuery.data?.report.items ?? []}
              meta={reportQuery.data?.meta}
              loading={reportQuery.isLoading || reportQuery.isFetching}
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
