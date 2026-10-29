'use client';

import { useRef, useState } from 'react';
import { Flex, Input, Segmented, Typography } from 'antd';

import type { ProductListParams } from '../use-list-params';

type ProductFiltersProps = {
  search: string;
  isActive: ProductListParams['isActive'];
  onChange: (patch: Partial<ProductListParams>) => void;
};

const DEBOUNCE_MS = 400;

/**
 * Filters for the product list.
 *
 * The text input debounces so typing does not fire a request per keystroke, while the
 * segmented control applies immediately. Local state is adjusted during render when the
 * URL changes (back/forward), which avoids a setState-in-effect cascade.
 */
export function ProductFilters({ search, isActive, onChange }: ProductFiltersProps) {
  const [value, setValue] = useState(search);
  const [lastSearch, setLastSearch] = useState(search);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (search !== lastSearch) {
    setLastSearch(search);
    setValue(search);
  }

  function scheduleSearch(next: string): void {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      onChange({ search: next });
    }, DEBOUNCE_MS);
  }

  return (
    <Flex wrap gap={12} align="center" justify="space-between">
      <Flex gap={12} align="center" wrap>
        <Input
          allowClear
          value={value}
          placeholder="Search SKU, name or description"
          style={{ width: 320 }}
          onChange={(event) => {
            const next = event.target.value;
            setValue(next);
            scheduleSearch(next);
          }}
          onPressEnter={() => {
            if (timer.current) {
              clearTimeout(timer.current);
            }
            onChange({ search: value });
          }}
        />
        <Segmented
          value={isActive}
          options={[
            { label: 'Active', value: 'true' },
            { label: 'Inactive', value: 'false' },
            { label: 'All', value: 'all' },
          ]}
          onChange={(next) => onChange({ isActive: next as ProductListParams['isActive'] })}
        />
      </Flex>
      <Typography.Text type="secondary">
        The list is filtered on the server; paging is offset based.
      </Typography.Text>
    </Flex>
  );
}
