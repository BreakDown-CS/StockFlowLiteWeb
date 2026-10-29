import { describe, expect, it } from 'vitest';

import {
  createCsrfToken,
  isSessionExpired,
  openSession,
  sealSession,
  secretsMatch,
  SessionDecodeError,
  SESSION_VERSION,
  toEpochSeconds,
  type SessionPayload,
} from '@/lib/server/session-crypto';

const SECRET = 'unit-test-secret-with-at-least-32-characters';
const OTHER_SECRET = 'a-completely-different-secret-32-chars-min';

function payload(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    v: SESSION_VERSION,
    token: 'opaque-backend-token-value',
    exp: Math.floor(Date.now() / 1000) + 3600,
    csrf: createCsrfToken(),
    user: { id: '11111111-1111-4111-8111-111111111111', username: 'admin', role: 'ADMIN' },
    ...overrides,
  };
}

describe('sealSession / openSession', () => {
  it('round-trips a payload', () => {
    const original = payload();
    const blob = sealSession(original, SECRET);

    expect(openSession(blob, SECRET)).toEqual(original);
  });

  it('never stores the token in plaintext', () => {
    const original = payload();
    const blob = sealSession(original, SECRET);

    expect(blob).not.toContain(original.token);
    expect(blob).not.toContain('admin');
    expect(blob.startsWith('v1.')).toBe(true);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const original = payload();
    expect(sealSession(original, SECRET)).not.toBe(sealSession(original, SECRET));
  });

  it('rejects a tampered ciphertext', () => {
    const blob = sealSession(payload(), SECRET);

    // Decode, flip a byte of the ciphertext, re-encode. Flipping the last base64
    // character is not a reliable tamper: it can only touch padding bits.
    const bytes = Buffer.from(blob.slice('v1.'.length), 'base64url');
    const last = bytes.length - 1;
    bytes[last] = (bytes[last] ?? 0) ^ 0xff;
    const tampered = `v1.${Buffer.from(bytes).toString('base64url')}`;

    expect(tampered).not.toBe(blob);
    expect(() => openSession(tampered, SECRET)).toThrow(SessionDecodeError);
  });

  it('rejects a foreign key', () => {
    const blob = sealSession(payload(), SECRET);
    expect(() => openSession(blob, OTHER_SECRET)).toThrow(SessionDecodeError);
  });

  it('rejects an unknown payload version', () => {
    const blob = sealSession(payload(), SECRET);
    expect(() => openSession(`v2.${blob.slice(3)}`, SECRET)).toThrow(/version/i);
  });

  it('rejects a payload that is too short', () => {
    expect(() => openSession('v1.AAAA', SECRET)).toThrow(SessionDecodeError);
  });

  it('rejects a secret shorter than 32 characters', () => {
    expect(() => sealSession(payload(), 'too-short')).toThrow(/SESSION_SECRET/);
  });
});

describe('isSessionExpired', () => {
  it('treats a future expiry as valid', () => {
    const now = Date.now();
    expect(isSessionExpired(payload({ exp: Math.floor(now / 1000) + 60 }), now)).toBe(false);
  });

  it('treats a past expiry as expired', () => {
    const now = Date.now();
    expect(isSessionExpired(payload({ exp: Math.floor(now / 1000) - 1 }), now)).toBe(true);
  });

  it('treats "exactly now" as expired', () => {
    const now = 1_700_000_000_000;
    expect(isSessionExpired(payload({ exp: 1_700_000_000 }), now)).toBe(true);
  });
});

describe('toEpochSeconds', () => {
  it('parses an RFC3339 timestamp with nanoseconds and Z', () => {
    expect(toEpochSeconds('2026-10-28T10:00:00.123456789Z')).toBe(1_793_181_600);
  });

  it('parses an RFC3339 timestamp with an offset', () => {
    expect(toEpochSeconds('2026-10-28T17:00:00+07:00')).toBe(1_793_181_600);
  });

  it('throws on garbage', () => {
    expect(() => toEpochSeconds('not-a-date')).toThrow(SessionDecodeError);
  });
});

describe('secretsMatch', () => {
  it('matches identical values', () => {
    expect(secretsMatch('abc123', 'abc123')).toBe(true);
  });

  it('rejects different values of the same length', () => {
    expect(secretsMatch('abc123', 'abc124')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(secretsMatch('abc123', 'abc12')).toBe(false);
  });
});
