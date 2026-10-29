import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/lib/server/env-schema';

const baseEnv = {
  NODE_ENV: 'development',
  BACKEND_API_URL: 'http://127.0.0.1:8080',
  APP_ORIGIN: 'http://localhost:3000',
  SESSION_SECRET: 'a'.repeat(32),
};

describe('parseEnv', () => {
  it('parses a minimal valid environment and applies defaults', () => {
    const env = parseEnv(baseEnv);

    expect(env.nodeEnv).toBe('development');
    expect(env.backendApiUrl).toBe('http://127.0.0.1:8080');
    expect(env.appOrigin).toBe('http://localhost:3000');
    // Development runs on plain HTTP, so an unset SESSION_COOKIE_SECURE means "not secure".
    expect(env.cookieSecure).toBe(false);
    expect(env.backendTimeoutMs).toBe(10_000);
    expect(env.loginRateLimitMax).toBe(10);
    expect(env.loginRateLimitWindowMs).toBe(900_000);
    expect(env.defaultReportRangeDays).toBe(30);
    expect(env.appName).toBe('StockFlow Lite');
  });

  it('strips trailing slashes so upstream URLs never double up', () => {
    const env = parseEnv({ ...baseEnv, BACKEND_API_URL: 'http://api:8080///' });
    expect(env.backendApiUrl).toBe('http://api:8080');
  });

  it('coerces numeric strings coming from the environment', () => {
    const env = parseEnv({
      ...baseEnv,
      BACKEND_TIMEOUT_MS: '2500',
      LOGIN_RATE_LIMIT_MAX: '5',
      DEFAULT_REPORT_RANGE_DAYS: '90',
    });

    expect(env.backendTimeoutMs).toBe(2_500);
    expect(env.loginRateLimitMax).toBe(5);
    expect(env.defaultReportRangeDays).toBe(90);
  });

  it('rejects a short SESSION_SECRET and names the variable', () => {
    expect(() => parseEnv({ ...baseEnv, SESSION_SECRET: 'too-short' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('rejects a missing BACKEND_API_URL and names the variable', () => {
    const { BACKEND_API_URL: _omitted, ...withoutBackend } = baseEnv;
    expect(() => parseEnv(withoutBackend)).toThrow(/BACKEND_API_URL/);
  });

  it('rejects a non-http(s) backend URL', () => {
    expect(() => parseEnv({ ...baseEnv, BACKEND_API_URL: 'ftp://api:21' })).toThrow(
      /BACKEND_API_URL/,
    );
  });

  it('rejects insecure cookies in production', () => {
    expect(() =>
      parseEnv({ ...baseEnv, NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }),
    ).toThrow(/SESSION_COOKIE_SECURE/);
  });

  it('allows insecure cookies outside production (loopback dev only)', () => {
    const env = parseEnv({ ...baseEnv, SESSION_COOKIE_SECURE: 'false' });
    expect(env.cookieSecure).toBe(false);
  });

  it('defaults to secure cookies in production when the variable is unset', () => {
    const env = parseEnv({ ...baseEnv, NODE_ENV: 'production' });
    expect(env.cookieSecure).toBe(true);
  });

  it('honours an explicit secure cookie outside production', () => {
    const env = parseEnv({ ...baseEnv, SESSION_COOKIE_SECURE: 'true' });
    expect(env.cookieSecure).toBe(true);
  });

  it('rejects an unknown NODE_ENV value', () => {
    expect(() => parseEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('never echoes the secret value in the error message', () => {
    const secret = 'short-secret-value';
    try {
      parseEnv({ ...baseEnv, SESSION_SECRET: secret });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
