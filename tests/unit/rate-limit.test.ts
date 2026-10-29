import { describe, expect, it } from 'vitest';

import { FixedWindowLimiter } from '@/lib/server/rate-limit';

describe('FixedWindowLimiter', () => {
  it('allows up to the limit and then blocks', () => {
    const limiter = new FixedWindowLimiter(3, 60_000);
    const now = 1_000_000;

    expect(limiter.consume('k', now).allowed).toBe(true);
    expect(limiter.consume('k', now + 1).allowed).toBe(true);
    expect(limiter.consume('k', now + 2).allowed).toBe(true);

    const blocked = limiter.consume('k', now + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('reports a retry delay that shrinks as the window elapses', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    const now = 1_000_000;
    limiter.consume('k', now);

    const early = limiter.consume('k', now + 1_000);
    const late = limiter.consume('k', now + 50_000);

    expect(early.retryAfterSeconds).toBeGreaterThan(late.retryAfterSeconds);
    expect(late.retryAfterSeconds).toBeLessThanOrEqual(10);
  });

  it('resets after the window passes', () => {
    const limiter = new FixedWindowLimiter(2, 1_000);
    const now = 1_000_000;

    limiter.consume('k', now);
    limiter.consume('k', now);
    expect(limiter.consume('k', now).allowed).toBe(false);
    expect(limiter.consume('k', now + 1_000).allowed).toBe(true);
  });

  it('isolates keys', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    const now = 1_000_000;

    expect(limiter.consume('a', now).allowed).toBe(true);
    expect(limiter.consume('a', now).allowed).toBe(false);
    expect(limiter.consume('b', now).allowed).toBe(true);
  });

  it('clears a key on reset', () => {
    const limiter = new FixedWindowLimiter(1, 60_000);
    const now = 1_000_000;

    limiter.consume('k', now);
    expect(limiter.consume('k', now).allowed).toBe(false);

    limiter.reset('k');
    expect(limiter.consume('k', now).allowed).toBe(true);
  });

  it('bounds memory by evicting keys', () => {
    const limiter = new FixedWindowLimiter(5, 60_000, 10);
    const now = 1_000_000;

    for (let index = 0; index < 50; index += 1) {
      limiter.consume(`key-${index}`, now + index);
    }

    expect(limiter.size).toBeLessThanOrEqual(10);
  });

  it('rejects nonsensical configuration', () => {
    expect(() => new FixedWindowLimiter(0, 1_000)).toThrow();
    expect(() => new FixedWindowLimiter(1, 0)).toThrow();
  });
});
