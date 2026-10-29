'use client';

import { Button, Flex, Select, Typography } from 'antd';

import { REQUEST_STATUSES, type RequestStatus } from '../types';

/**
 * Request filters.
 *
 * Only `status` exists on this endpoint — no dates, no search. The date-based view lives
 * in the reports screens, and the UI says so instead of offering a filter that silently
 * does nothing.
 */
export function RequestFilters({
  status,
  onChange,
}: {
  status?: RequestStatus;
  onChange: (status: RequestStatus | undefined) => void;
}) {
  return (
    <Flex wrap gap={12} align="center" justify="space-between">
      <Flex gap={12} align="center">
        <Select<RequestStatus>
          allowClear
          value={status}
          placeholder="All statuses"
          style={{ width: 180 }}
          onChange={(next) => onChange(next)}
          options={REQUEST_STATUSES.map((value) => ({ value, label: value }))}
        />
        <Button onClick={() => onChange(undefined)}>Clear</Button>
      </Flex>
      <Typography.Text type="secondary">
        Requesters only ever see their own requests. Date filtering is available in the
        request report.
      </Typography.Text>
    </Flex>
  );
}
