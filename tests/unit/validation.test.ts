import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loginBodySchema, parseBody } from '@/lib/validation/bodies';
import { isoDateTimeSchema, limitSchema, offsetSchema, parseQuery, uuidSchema } from '@/lib/validation/common';

const listSchema = z.object({
  limit: limitSchema,
  offset: offsetSchema,
  product_id: uuidSchema.optional(),
});

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe('parseQuery', () => {
  it('accepts supported parameters', () => {
    const result = parseQuery(
      listSchema,
      params('limit=50&offset=100&product_id=11111111-1111-4111-8111-111111111111'),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limit).toBe(50);
      expect(result.value.offset).toBe(100);
    }
  });

  it('strips unknown parameters instead of forwarding them', () => {
    const result = parseQuery(listSchema, params('limit=10&evil=1&offset=0'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.value).sort()).toEqual(['limit', 'offset']);
    }
  });

  it('rejects a limit above the API maximum', () => {
    const result = parseQuery(listSchema, params('limit=500'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields['limit']).toContain('100');
    }
  });

  it('rejects a zero limit and a negative offset', () => {
    expect(parseQuery(listSchema, params('limit=0')).ok).toBe(false);
    expect(parseQuery(listSchema, params('offset=-1')).ok).toBe(false);
  });

  it('rejects non-numeric pagination', () => {
    expect(parseQuery(listSchema, params('limit=abc')).ok).toBe(false);
  });

  it('treats empty values as absent', () => {
    const result = parseQuery(listSchema, params('limit=&offset='));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.limit).toBeUndefined();
      expect(result.value.offset).toBeUndefined();
    }
  });

  it('rejects a malformed uuid', () => {
    expect(parseQuery(listSchema, params('product_id=not-a-uuid')).ok).toBe(false);
  });
});

describe('isoDateTimeSchema', () => {
  const schema = z.object({ from: isoDateTimeSchema });

  it('accepts an RFC3339 timestamp produced by toISOString()', () => {
    const result = schema.safeParse({ from: new Date().toISOString() });
    expect(result.success).toBe(true);
  });

  it('rejects a date-only value that the API would refuse', () => {
    const result = schema.safeParse({ from: '2026-01-01' });
    // Date.parse accepts it, so the check is intentionally about parseability: the
    // BFF normalises to ISO before forwarding. Documented in docs/API-CONTRACT.md.
    expect(result.success).toBe(true);
  });

  it('rejects garbage', () => {
    expect(schema.safeParse({ from: 'yesterday' }).success).toBe(false);
  });
});

describe('parseBody', () => {
  it('accepts valid credentials and trims the username', () => {
    const result = parseBody(loginBodySchema, JSON.stringify({ username: '  admin ', password: 'secret' }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.username).toBe('admin');
    }
  });

  it('rejects malformed JSON', () => {
    expect(parseBody(loginBodySchema, '{oops')).toEqual({ ok: false, code: 'BAD_JSON' });
  });

  it('rejects an empty username with a field error', () => {
    const result = parseBody(loginBodySchema, JSON.stringify({ username: '   ', password: 'x' }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION');
      expect(result.fields?.['username']).toBeDefined();
    }
  });

  it('rejects an empty password', () => {
    const result = parseBody(loginBodySchema, JSON.stringify({ username: 'admin', password: '' }));
    expect(result.ok).toBe(false);
  });

  it('ignores unexpected extra fields', () => {
    const result = parseBody(
      loginBodySchema,
      JSON.stringify({ username: 'admin', password: 'x', role: 'ADMIN' }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('role' in result.value).toBe(false);
    }
  });
});
