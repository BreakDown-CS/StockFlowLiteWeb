export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the current window ends; 0 when allowed. */
  retryAfterSeconds: number;
};

type Bucket = {
  count: number;
  windowStart: number;
};

/**
 * Fixed-window in-memory limiter.
 *
 * Deliberately simple: this is defence in depth in front of the API, which has its
 * own limiter. Because it is process-local, a horizontally scaled deployment gets
 * one budget per instance — documented in docs/SECURITY.md. The memory footprint is
 * bounded so a flood of distinct keys cannot exhaust the process.
 */
export class FixedWindowLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys: number = 10_000,
  ) {
    if (max <= 0) {
      throw new Error('FixedWindowLimiter requires max > 0');
    }
    if (windowMs <= 0) {
      throw new Error('FixedWindowLimiter requires windowMs > 0');
    }
  }

  consume(key: string, now: number = Date.now()): RateLimitResult {
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.evictIfNeeded(now);
      this.buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= this.max) {
      const remainingMs = this.windowMs - (now - existing.windowStart);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Clears a key, for example after a successful login. */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Number of tracked keys (test/observability helper). */
  get size(): number {
    return this.buckets.size;
  }

  private evictIfNeeded(now: number): void {
    if (this.buckets.size < this.maxKeys) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
    // Still full of live windows: drop the oldest entries rather than grow forever.
    if (this.buckets.size >= this.maxKeys) {
      const overflow = this.buckets.size - this.maxKeys + 1;
      let removed = 0;
      for (const key of this.buckets.keys()) {
        this.buckets.delete(key);
        removed += 1;
        if (removed >= overflow) {
          break;
        }
      }
    }
  }
}
