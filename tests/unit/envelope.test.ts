import { describe, expect, it } from 'vitest';

import {
  isFailure,
  isPageMeta,
  isRecord,
  isSuccess,
  parseEnvelope,
} from '@/lib/api/envelope';

describe('envelope guards', () => {
  it('accepts a plain object and rejects arrays, null and primitives', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('text')).toBe(false);
    expect(isRecord(42)).toBe(false);
  });

  it('recognises a success envelope with data', () => {
    const payload = { success: true, data: { id: 'p1' }, message: 'ok' };
    expect(isSuccess(payload)).toBe(true);
    expect(isFailure(payload)).toBe(false);
  });

  it('rejects a "success: true" payload that carries no data key', () => {
    expect(isSuccess({ success: true })).toBe(false);
  });

  it('recognises a failure envelope', () => {
    const payload = { success: false, error: { code: 'FORBIDDEN', message: 'nope' } };
    expect(isFailure(payload)).toBe(true);
    expect(isSuccess(payload)).toBe(false);
  });

  it('does not treat a malformed error body as a failure envelope', () => {
    expect(isFailure({ success: false, error: { code: 'X' } })).toBe(false);
    expect(isFailure({ success: false, error: 'boom' })).toBe(false);
    expect(isFailure({ success: false })).toBe(false);
  });

  it('validates the pagination meta block used by list endpoints', () => {
    expect(isPageMeta({ limit: 20, offset: 0, total: 42 })).toBe(true);
    expect(isPageMeta({ limit: '20', offset: 0, total: 42 })).toBe(false);
    expect(isPageMeta({ limit: 20, offset: 0 })).toBe(false);
    expect(isPageMeta(null)).toBe(false);
  });
});

describe('parseEnvelope', () => {
  it('returns a failure envelope unchanged', () => {
    const payload = { success: false as const, error: { code: 'NOT_FOUND', message: 'gone' } };
    expect(parseEnvelope(payload)).toBe(payload);
  });

  it('returns a success envelope unchanged', () => {
    const payload = { success: true as const, data: [1, 2, 3] };
    expect(parseEnvelope<number[]>(payload)).toBe(payload);
  });

  it('throws on a plain-text upstream body', () => {
    expect(() => parseEnvelope('Cannot POST /api/v1/products')).toThrow(TypeError);
  });

  it('throws on an HTML error page from a reverse proxy', () => {
    expect(() => parseEnvelope('<html><body>502 Bad Gateway</body></html>')).toThrow(TypeError);
  });

  it('throws on an empty body', () => {
    expect(() => parseEnvelope(undefined)).toThrow(TypeError);
  });
});
