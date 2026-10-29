import { describe, expect, it } from 'vitest';

import {
  ApiError,
  BFF_ERROR,
  envelopeFromError,
  normalizeUpstreamError,
} from '@/lib/api/errors';

describe('normalizeUpstreamError', () => {
  it('passes through a JSON failure envelope', () => {
    const body = JSON.stringify({
      success: false,
      error: { code: 'INSUFFICIENT_STOCK', message: 'not enough', details: { items: [] } },
    });

    const result = normalizeUpstreamError(409, 'application/json; charset=utf-8', body);

    expect(result.status).toBe(409);
    expect(result.code).toBe('INSUFFICIENT_STOCK');
    expect(result.message).toBe('not enough');
    expect(result.details).toEqual({ items: [] });
  });

  it('falls back to a status default when the envelope has no error object', () => {
    const body = JSON.stringify({ success: false });
    const result = normalizeUpstreamError(403, 'application/json', body);

    expect(result.code).toBe('FORBIDDEN');
  });

  it('normalises a plain-text 404 from the API router', () => {
    const result = normalizeUpstreamError(404, 'text/plain; charset=utf-8', 'Cannot POST /api/v1/nope');

    expect(result.status).toBe(404);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.details).toEqual({ upstream: 'Cannot POST /api/v1/nope' });
  });

  it('drops oversized plain-text bodies instead of echoing them', () => {
    const long = 'x'.repeat(500);
    const result = normalizeUpstreamError(400, 'text/plain', long);

    expect(result.details).toBeUndefined();
  });

  it('normalises an HTML error page without echoing markup', () => {
    const result = normalizeUpstreamError(502, 'text/html', '<html><body>502 Bad Gateway</body></html>');

    expect(result.code).toBe(BFF_ERROR.UPSTREAM_UNAVAILABLE);
    expect(JSON.stringify(result)).not.toContain('<html>');
  });

  it('handles an empty body', () => {
    const result = normalizeUpstreamError(405, '', '');
    expect(result.code).toBe('BAD_REQUEST');
  });

  it('maps 413 to a payload error', () => {
    expect(normalizeUpstreamError(413, 'text/plain', 'too big').code).toBe(
      'UPSTREAM_PAYLOAD_REJECTED',
    );
  });

  it('maps 5xx to a generic upstream error', () => {
    expect(normalizeUpstreamError(500, 'text/plain', '').code).toBe('UPSTREAM_ERROR');
  });

  it('keeps a JSON 500 code but not raw internals', () => {
    const body = JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve products' },
    });
    const result = normalizeUpstreamError(500, 'application/json', body);

    expect(result.code).toBe('INTERNAL_ERROR');
    expect(result.message).toBe('Failed to retrieve products');
  });

  it('treats an unparsable JSON body as a status default', () => {
    const result = normalizeUpstreamError(400, 'application/json', '{not json');
    expect(result.code).toBe('BAD_REQUEST');
  });
});

describe('envelopeFromError', () => {
  it('omits the details key when there are none', () => {
    const envelope = envelopeFromError({ status: 403, code: 'FORBIDDEN', message: 'no' });

    expect(envelope.success).toBe(false);
    expect(envelope.error).toEqual({ code: 'FORBIDDEN', message: 'no' });
    expect('details' in envelope.error).toBe(false);
  });

  it('keeps details when supplied', () => {
    const envelope = envelopeFromError({
      status: 409,
      code: 'INVALID_STATE',
      message: 'conflict',
      details: { current_status: 'ISSUED' },
    });

    expect(envelope.error.details).toEqual({ current_status: 'ISSUED' });
  });
});

describe('ApiError', () => {
  it('is not retryable for 4xx client mistakes', () => {
    const error = new ApiError({ status: 400, code: 'VALIDATION_ERROR', message: 'bad' });
    expect(error.retryable).toBe(false);
  });

  it('is retryable for 429 and gateway failures', () => {
    expect(new ApiError({ status: 429, code: 'X', message: '' }).retryable).toBe(true);
    expect(new ApiError({ status: 502, code: 'X', message: '' }).retryable).toBe(true);
    expect(new ApiError({ status: 504, code: 'X', message: '' }).retryable).toBe(true);
  });

  it('is retryable for 503', () => {
    expect(new ApiError({ status: 503, code: 'X', message: '' }).retryable).toBe(true);
  });
});
