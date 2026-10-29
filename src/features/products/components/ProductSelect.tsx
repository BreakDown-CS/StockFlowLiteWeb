'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { Select, Spin } from 'antd';

import { useProducts } from '../hooks';

/**
 * Async product picker.
 *
 * Searches on the server (`/products?search=…&limit=20`) instead of preloading the whole
 * catalogue, debounced so typing does not fire a request per keystroke. Works inside an
 * antd `Form.Item` because it accepts `value` / `onChange`.
 */
export function ProductSelect({
  value,
  onChange,
  placeholder = 'Search products by SKU or name',
  activeOnly = true,
  allowClear = true,
  style,
  disabled,
}: {
  value?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  activeOnly?: boolean;
  allowClear?: boolean;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productsQuery = useProducts({
    search: term || undefined,
    isActive: activeOnly ? 'true' : 'all',
    limit: 20,
    offset: 0,
  });

  function scheduleTerm(next: string): void {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setTerm(next.trim()), 350);
  }

  const options = (productsQuery.data?.items ?? []).map((product) => ({
    value: product.id,
    label: `${product.sku} · ${product.name}`,
    disabled: activeOnly ? false : !product.isActive,
  }));

  return (
    <Select
      showSearch
      allowClear={allowClear}
      value={value}
      onChange={(next) => onChange?.(next)}
      placeholder={placeholder}
      filterOption={false}
      onSearch={scheduleTerm}
      options={options}
      loading={productsQuery.isFetching}
      notFoundContent={productsQuery.isFetching ? <Spin size="small" /> : 'No products found'}
      style={style}
      disabled={disabled}
    />
  );
}
