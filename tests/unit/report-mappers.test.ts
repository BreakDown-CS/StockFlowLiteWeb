import { describe, expect, it } from 'vitest';

import { toInventorySummary, toInventoryItem, toInventoryReport } from '@/features/reports/mappers';
import type { InventoryReportDTO } from '@/features/reports/types';

const row: InventoryReportDTO['items'][number] = {
  id: '11111111-1111-4111-8111-111111111111',
  sku: 'SKU-1',
  name: 'Gloves',
  unit: 'BOX',
  current_stock: 3,
  min_stock: 5,
  is_active: true,
  is_low_stock: true,
  is_out_of_stock: false,
  updated_at: '2026-10-28T10:00:00Z',
};

const summary: InventoryReportDTO['summary'] = {
  total_products: 10,
  active_products: 8,
  inactive_products: 2,
  low_stock_products: 1,
  out_of_stock_products: 0,
};

describe('inventory mappers', () => {
  it('converts snake_case wire fields to camelCase view models', () => {
    expect(toInventoryItem(row)).toEqual({
      id: row.id,
      sku: 'SKU-1',
      name: 'Gloves',
      unit: 'BOX',
      currentStock: 3,
      minStock: 5,
      isActive: true,
      isLowStock: true,
      isOutOfStock: false,
      updatedAt: '2026-10-28T10:00:00Z',
    });
  });

  it('keeps the timestamp as an ISO string (formatting happens at render time)', () => {
    expect(typeof toInventoryItem(row).updatedAt).toBe('string');
  });

  it('maps the summary counters', () => {
    expect(toInventorySummary(summary)).toEqual({
      totalProducts: 10,
      activeProducts: 8,
      inactiveProducts: 2,
      lowStockProducts: 1,
      outOfStockProducts: 0,
    });
  });

  it('maps a full report and preserves item order', () => {
    const second = { ...row, id: '22222222-2222-4222-8222-222222222222', sku: 'SKU-2' };
    const report = toInventoryReport({ summary, items: [row, second] });

    expect(report.items.map((item) => item.sku)).toEqual(['SKU-1', 'SKU-2']);
    expect(report.summary.totalProducts).toBe(10);
  });

  it('handles an empty item list', () => {
    expect(toInventoryReport({ summary, items: [] }).items).toEqual([]);
  });
});
