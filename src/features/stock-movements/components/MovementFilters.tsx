'use client';

import { Button, DatePicker, Flex, Select, Space, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import { ProductSelect } from '@/features/products/components/ProductSelect';
import { resolveReportRange } from '@/lib/validation/report-range';

import { MOVEMENT_TYPES, type MovementType } from '../types';
import type { MovementListParams } from '../use-movement-params';

const { RangePicker } = DatePicker;

const TYPE_LABELS: Record<MovementType, string> = {
  RECEIPT: 'Receipt',
  ISSUE: 'Issue',
  ADJUSTMENT: 'Adjustment',
};

/**
 * Ledger filters.
 *
 * The date range is converted to absolute instants: `from` is the start of the chosen
 * local day and `to` the end of it, so the filter covers the days the user picked in
 * their own time zone.
 */
export function MovementFilters({
  params,
  onChange,
}: {
  params: MovementListParams;
  onChange: (patch: Partial<MovementListParams>) => void;
}) {
  const range: [Dayjs, Dayjs] | null =
    params.from && params.to ? [dayjs(params.from), dayjs(params.to)] : null;

  return (
    <Flex wrap gap={12} align="center" justify="space-between">
      <Flex gap={12} wrap align="center">
        <ProductSelect
          activeOnly={false}
          value={params.productId}
          onChange={(productId) => onChange({ productId })}
          placeholder="All products"
          style={{ width: 280 }}
        />

        <Select<MovementType>
          allowClear
          value={params.movementType}
          placeholder="All types"
          style={{ width: 160 }}
          onChange={(movementType) => onChange({ movementType })}
          options={MOVEMENT_TYPES.map((type) => ({ value: type, label: TYPE_LABELS[type] }))}
        />

        <RangePicker
          value={range}
          onChange={(dates) => {
            const start = dates?.[0];
            const end = dates?.[1];
            if (!start || !end) {
              onChange({ from: undefined, to: undefined });
              return;
            }
            onChange({
              from: start.startOf('day').toISOString(),
              to: end.endOf('day').toISOString(),
            });
          }}
        />

        <Space size={8}>
          <Button
            onClick={() => {
              const range = resolveReportRange({});
              onChange({ from: range.from, to: range.to });
            }}
          >
            Last 30 days
          </Button>
          <Button onClick={() => onChange({ from: undefined, to: undefined })}>All time</Button>
          <Button
            onClick={() =>
              onChange({
                productId: undefined,
                movementType: undefined,
                from: undefined,
                to: undefined,
              })
            }
          >
            Clear
          </Button>
        </Space>
      </Flex>

      <Typography.Text type="secondary">
        No date range means the whole ledger (the API applies no default window).
      </Typography.Text>
    </Flex>
  );
}
