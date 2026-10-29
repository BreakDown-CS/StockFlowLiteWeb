import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { checkCsrfToken, checkMutation, checkOrigin, CSRF_HEADER } from '@/lib/server/csrf';

const APP_ORIGIN = 'http://localhost:3000';

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('checkCsrfToken', () => {
  it('accepts a matching token', () => {
    expect(checkCsrfToken('secret-value', 'secret-value')).toEqual({ ok: true });
  });

  it('rejects a missing header', () => {
    expect(checkCsrfToken('secret-value', null)).toEqual({ ok: false, reason: 'missing-token' });
  });

  it('rejects a mismatched token', () => {
    expect(checkCsrfToken('secret-value', 'other-value')).toEqual({
      ok: false,
      reason: 'token-mismatch',
    });
  });

  it('rejects a token of a different length without throwing', () => {
    expect(checkCsrfToken('secret-value', 'short')).toEqual({
      ok: false,
      reason: 'token-mismatch',
    });
  });
});

describe('checkOrigin', () => {
  it('accepts a matching Origin', () => {
    expect(checkOrigin(request('/api/bff/x', { origin: APP_ORIGIN }), APP_ORIGIN)).toEqual({
      ok: true,
    });
  });

  it('accepts a matching Origin with different casing and a trailing slash in config', () => {
    const result = checkOrigin(
      request('/api/bff/x', { origin: 'http://LOCALHOST:3000' }),
      'http://localhost:3000/',
    );
    expect(result).toEqual({ ok: true });
  });

  it('falls back to the Referer origin', () => {
    const result = checkOrigin(
      request('/api/bff/x', { referer: 'http://localhost:3000/products?page=2' }),
      APP_ORIGIN,
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects a foreign Origin', () => {
    expect(checkOrigin(request('/api/bff/x', { origin: 'https://evil.example' }), APP_ORIGIN)).toEqual(
      { ok: false, reason: 'bad-origin' },
    );
  });

  it('rejects a foreign Referer', () => {
    expect(
      checkOrigin(request('/api/bff/x', { referer: 'https://evil.example/attack' }), APP_ORIGIN),
    ).toEqual({ ok: false, reason: 'bad-origin' });
  });

  it('rejects when neither header is present', () => {
    expect(checkOrigin(request('/api/bff/x'), APP_ORIGIN)).toEqual({
      ok: false,
      reason: 'missing-origin',
    });
  });

  it('rejects a malformed Origin', () => {
    expect(checkOrigin(request('/api/bff/x', { origin: 'not a url' }), APP_ORIGIN)).toEqual({
      ok: false,
      reason: 'bad-origin',
    });
  });

  it('does not accept a look-alike subdomain', () => {
    expect(
      checkOrigin(request('/api/bff/x', { origin: 'http://localhost:3000.evil.example' }), APP_ORIGIN),
    ).toEqual({ ok: false, reason: 'bad-origin' });
  });
});

describe('checkMutation', () => {
  it('requires the origin before the token', () => {
    const result = checkMutation(request('/api/bff/x'), 'secret', APP_ORIGIN);
    expect(result).toEqual({ ok: false, reason: 'missing-origin' });
  });

  it('rejects a valid origin with a missing token', () => {
    const result = checkMutation(request('/api/bff/x', { origin: APP_ORIGIN }), 'secret', APP_ORIGIN);
    expect(result).toEqual({ ok: false, reason: 'missing-token' });
  });

  it('accepts a valid origin and token', () => {
    const result = checkMutation(
      request('/api/bff/x', { origin: APP_ORIGIN, [CSRF_HEADER]: 'secret' }),
      'secret',
      APP_ORIGIN,
    );
    expect(result).toEqual({ ok: true });
  });

  it('ignores a token sent under the wrong header name', () => {
    const result = checkMutation(
      request('/api/bff/x', { origin: APP_ORIGIN, 'x-xsrf-token': 'secret' }),
      'secret',
      APP_ORIGIN,
    );
    expect(result).toEqual({ ok: false, reason: 'missing-token' });
  });
});
