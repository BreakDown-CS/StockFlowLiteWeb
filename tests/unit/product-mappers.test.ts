import { describe, expect, it } from 'vitest';

import { toCreateProductBody, toProduct, toUpdateProductBody } from '@/features/products/mappers';
import type { ProductDTO } from '@/features/products/types';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  pageFromOffset,
  parseIsActive,
  parseLimit,
  parseOffset,
} from '@/lib/validation/list-params';

const dto: ProductDTO = {
  id: '11111111-1111-4111-8111-111111111111',
  sku: 'SKU-1001',
  name: 'Nitrile gloves',
  unit: 'BOX',
  current_stock: 42,
  min_stock: 10,
  is_active: true,
  created_at: '2026-10-01T08:00:00Z',
  updated_at: '2026-10-02T09:30:00Z',
};

describe('product mappers', () => {
  it('maps the wire shape to a view model, defaulting a missing description', () => {
    expect(toProduct(dto)).toEqual({
      id: dto.id,
      sku: 'SKU-1001',
      name: 'Nitrile gloves',
      description: '',
      unit: 'BOX',
      currentStock: 42,
      minStock: 10,
      isActive: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-02T09:30:00Z',
    });
  });

  it('keeps a provided description', () => {
    expect(toProduct({ ...dto, description: 'Powder free' }).description).toBe('Powder free');
  });

  it('trims the create body and drops blank optional fields', () => {
    const body = toCreateProductBody({
      sku: '  SKU-1001  ',
      name: '  Nitrile gloves ',
      description: '   ',
      unit: '  ',
      minStock: 10,
    });

    expect(body).toEqual({ sku: 'SKU-1001', name: 'Nitrile gloves', min_stock: 10 });
    expect('description' in body).toBe(false);
    expect('unit' in body).toBe(false);
  });

  it('keeps optional create values when present', () => {
    const body = toCreateProductBody({
      sku: 'SKU-2',
      name: 'Mask',
      description: 'Type II',
      unit: 'BOX',
      minStock: 0,
    });

    expect(body).toEqual({
      sku: 'SKU-2',
      name: 'Mask',
      description: 'Type II',
      unit: 'BOX',
      min_stock: 0,
    });
  });

  it('never sends sku on update (the API update contract has no sku field)', () => {
    const body = toUpdateProductBody({ name: 'Mask', description: 'x', unit: 'BOX', minStock: 5 });
    expect('sku' in body).toBe(false);
  });

  it('sends an empty description on update so clearing it actually clears it', () => {
    const body = toUpdateProductBody({ name: 'Mask', description: '   ' });
    expect(body.description).toBe('');
  });
});

describe('list parameter parsing', () => {
  it('defaults a missing or invalid limit', () => {
    expect(parseLimit(null)).toBe(DEFAULT_LIMIT);
    expect(parseLimit('abc')).toBe(DEFAULT_LIMIT);
    expect(parseLimit('0')).toBe(DEFAULT_LIMIT);
    expect(parseLimit('-5')).toBe(DEFAULT_LIMIT);
    expect(parseLimit('1.5')).toBe(DEFAULT_LIMIT);
  });

  it('clamps the limit to the API maximum', () => {
    expect(parseLimit('50')).toBe(50);
    expect(parseLimit('100')).toBe(100);
    expect(parseLimit('500')).toBe(MAX_LIMIT);
  });

  it('guards the offset', () => {
    expect(parseOffset(null)).toBe(0);
    expect(parseOffset('-1')).toBe(0);
    expect(parseOffset('nope')).toBe(0);
    expect(parseOffset('40')).toBe(40);
  });

  it('defaults the active filter to "true" like the API does', () => {
    expect(parseIsActive(null)).toBe('true');
    expect(parseIsActive('maybe')).toBe('true');
    expect(parseIsActive('false')).toBe('false');
    expect(parseIsActive('all')).toBe('all');
  });

  it('converts an offset back to a page number', () => {
    expect(pageFromOffset(0, 20)).toBe(1);
    expect(pageFromOffset(20, 20)).toBe(2);
    expect(pageFromOffset(45, 20)).toBe(3);
    expect(pageFromOffset(0, 0)).toBe(1);
  });
});
