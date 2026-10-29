import { describe, expect, it } from 'vitest';

import { toReceiptBody } from '@/features/stock-receipts/api';
import {
  signedQuantityFor,
  toMovementReport,
  toMovementSummary,
  toStockMovement,
} from '@/features/stock-movements/mappers';
import type { MovementReportRowDTO } from '@/features/stock-movements/types';

const row: MovementReportRowDTO = {
  id: 42,
  product_id: '11111111-1111-4111-8111-111111111111',
  sku: 'SKU-1001',
  product_name: 'Nitrile gloves',
  movement_type: 'ISSUE',
  quantity: 5,
  signed_quantity: -5,
  reference_type: 'STOCK_REQUEST',
  reference_id: '22222222-2222-4222-8222-222222222222',
  actor_id: '33333333-3333-4333-8333-333333333333',
  notes: 'ward stock',
  created_at: '2026-10-28T10:00:00Z',
};

describe('signedQuantityFor', () => {
  it('adds for receipts and adjustments', () => {
    expect(signedQuantityFor('RECEIPT', 7)).toBe(7);
    expect(signedQuantityFor('ADJUSTMENT', 3)).toBe(3);
  });

  it('subtracts for issues', () => {
    expect(signedQuantityFor('ISSUE', 5)).toBe(-5);
  });

  it('never changes the magnitude', () => {
    expect(Math.abs(signedQuantityFor('ISSUE', 12))).toBe(12);
  });
});

describe('movement mappers', () => {
  it('maps a report row to a view model, defaulting optional fields', () => {
    const mapped = toStockMovement({ ...row, reference_id: undefined, actor_id: undefined, notes: undefined });

    expect(mapped).toMatchObject({
      id: 42,
      sku: 'SKU-1001',
      productName: 'Nitrile gloves',
      movementType: 'ISSUE',
      quantity: 5,
      signedQuantity: -5,
      referenceId: '',
      actorId: '',
      notes: '',
    });
  });

  it('keeps the signed quantity supplied by the report', () => {
    expect(toStockMovement(row).signedQuantity).toBe(-5);
  });

  it('maps the summary counters', () => {
    expect(
      toMovementSummary({
        movement_count: 9,
        receipt_total_quantity: 40,
        issue_total_quantity: 12,
        adjustment_total_quantity: 0,
        net_change: 28,
      }),
    ).toEqual({
      movementCount: 9,
      receiptTotalQuantity: 40,
      issueTotalQuantity: 12,
      adjustmentTotalQuantity: 0,
      netChange: 28,
    });
  });

  it('maps a full report preserving row order', () => {
    const report = toMovementReport({
      summary: {
        movement_count: 2,
        receipt_total_quantity: 10,
        issue_total_quantity: 5,
        adjustment_total_quantity: 0,
        net_change: 5,
      },
      items: [row, { ...row, id: 43 }],
    });

    expect(report.items.map((item) => item.id)).toEqual([42, 43]);
    expect(report.summary.netChange).toBe(5);
  });
});

describe('toReceiptBody', () => {
  it('trims notes and keeps the quantity', () => {
    expect(toReceiptBody({ productId: 'abc', quantity: 12, notes: '  delivery  ' })).toEqual({
      product_id: 'abc',
      quantity: 12,
      notes: 'delivery',
    });
  });

  it('omits blank notes', () => {
    const body = toReceiptBody({ productId: 'abc', quantity: 1, notes: '   ' });
    expect('notes' in body).toBe(false);
  });
});
