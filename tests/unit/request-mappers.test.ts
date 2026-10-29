import { describe, expect, it } from 'vitest';

import {
  toCreateRequestBody,
  toShortages,
  toStockRequest,
} from '@/features/stock-requests/mappers';
import type { StockRequestDTO } from '@/features/stock-requests/types';
import { isIdempotencyKey } from '@/lib/validation/bodies';

const dto: StockRequestDTO = {
  id: '11111111-1111-4111-8111-111111111111',
  request_number: 'REQ-20261028-ABCD1234',
  requester_id: '22222222-2222-4222-8222-222222222222',
  status: 'APPROVED',
  notes: 'ward stock',
  reviewer_id: '33333333-3333-4333-8333-333333333333',
  reviewed_at: '2026-10-28T11:00:00Z',
  created_at: '2026-10-28T10:00:00Z',
  updated_at: '2026-10-28T11:00:00Z',
  items: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      request_id: '11111111-1111-4111-8111-111111111111',
      product_id: '55555555-5555-4555-8555-555555555555',
      requested_quantity: 4,
    },
  ],
  issuance: {
    id: '66666666-6666-4666-8666-666666666666',
    request_id: '11111111-1111-4111-8111-111111111111',
    item_count: 1,
    total_quantity: 4,
    created_at: '2026-10-28T12:00:00Z',
  },
};

describe('toStockRequest', () => {
  it('maps the wire shape including items and issuance', () => {
    const mapped = toStockRequest(dto);

    expect(mapped.requestNumber).toBe('REQ-20261028-ABCD1234');
    expect(mapped.status).toBe('APPROVED');
    expect(mapped.reviewerId).toBe(dto.reviewer_id);
    expect(mapped.items).toHaveLength(1);
    expect(mapped.items[0]?.requestedQuantity).toBe(4);
    expect(mapped.issuance).toEqual({
      id: dto.issuance?.id,
      itemCount: 1,
      totalQuantity: 4,
      createdAt: '2026-10-28T12:00:00Z',
    });
  });

  it('defaults optional fields on a minimal payload', () => {
    const mapped = toStockRequest({
      id: dto.id,
      request_number: dto.request_number,
      requester_id: dto.requester_id,
      status: 'PENDING',
      created_at: dto.created_at,
      updated_at: dto.updated_at,
    });

    expect(mapped.notes).toBe('');
    expect(mapped.reviewerId).toBe('');
    expect(mapped.rejectionReason).toBe('');
    expect(mapped.reviewedAt).toBeNull();
    expect(mapped.items).toEqual([]);
    expect(mapped.issuance).toBeNull();
  });
});

describe('toCreateRequestBody', () => {
  it('maps items and trims notes', () => {
    const body = toCreateRequestBody({
      items: [{ productId: 'p1', quantity: 2 }],
      notes: '  urgent  ',
    });

    expect(body).toEqual({ items: [{ product_id: 'p1', quantity: 2 }], notes: 'urgent' });
  });

  it('omits blank notes', () => {
    const body = toCreateRequestBody({ items: [{ productId: 'p1', quantity: 1 }], notes: '   ' });
    expect('notes' in body).toBe(false);
  });

  it('keeps every item, in order', () => {
    const body = toCreateRequestBody({
      items: [
        { productId: 'a', quantity: 1 },
        { productId: 'b', quantity: 9 },
      ],
    });
    expect(body.items.map((item) => item.product_id)).toEqual(['a', 'b']);
  });
});

describe('toShortages', () => {
  it('extracts every short line', () => {
    const shortages = toShortages({
      items: [
        { product_id: 'p1', requested: 5, available: 2, shortfall: 3 },
        { product_id: 'p2', requested: 1, available: 0, shortfall: 1 },
      ],
    });

    expect(shortages).toHaveLength(2);
    expect(shortages[0]).toEqual({
      productId: 'p1',
      requested: 5,
      available: 2,
      shortfall: 3,
    });
  });

  it('ignores malformed entries instead of throwing', () => {
    expect(toShortages({ items: [{ product_id: 'p1' }, null, 'x'] })).toEqual([]);
  });

  it('returns an empty list for a missing payload', () => {
    expect(toShortages(undefined)).toEqual([]);
    expect(toShortages({})).toEqual([]);
    expect(toShortages({ items: 'nope' })).toEqual([]);
  });
});

describe('isIdempotencyKey', () => {
  it('accepts a randomUUID', () => {
    expect(isIdempotencyKey('7b3f2c9e-1a4d-4f6b-9c8e-2d5a0b1c3e4f')).toBe(true);
  });

  it('accepts the documented character set', () => {
    expect(isIdempotencyKey('issue:req-1_v2.0')).toBe(true);
  });

  it('rejects values shorter than 8 or longer than 100', () => {
    expect(isIdempotencyKey('short')).toBe(false);
    expect(isIdempotencyKey('a'.repeat(101))).toBe(false);
    expect(isIdempotencyKey('a'.repeat(100))).toBe(true);
  });

  it('rejects unsupported characters', () => {
    expect(isIdempotencyKey('has space inside')).toBe(false);
    expect(isIdempotencyKey('emoji-😀-key')).toBe(false);
  });
});
