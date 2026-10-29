import { describe, expect, it } from 'vitest';

import { formatDuration, remainingMsUntil } from '@/lib/format/datetime';

const NOW = 1_700_000_000_000;
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('remainingMsUntil', () => {
  it('returns null for missing or empty input', () => {
    expect(remainingMsUntil(null, NOW)).toBeNull();
    expect(remainingMsUntil(undefined, NOW)).toBeNull();
    expect(remainingMsUntil('', NOW)).toBeNull();
  });

  it('returns null for an unparsable value', () => {
    expect(remainingMsUntil('not-a-date', NOW)).toBeNull();
  });

  it('returns a positive number for a future instant', () => {
    expect(remainingMsUntil(iso(90 * 60_000), NOW)).toBe(90 * 60_000);
  });

  it('returns a negative number once the instant has passed', () => {
    expect(remainingMsUntil(iso(-1_000), NOW)).toBe(-1_000);
  });

  it('returns zero exactly at the instant', () => {
    expect(remainingMsUntil(iso(0), NOW)).toBe(0);
  });
});

describe('formatDuration', () => {
  it('labels anything at or past zero as expired', () => {
    expect(formatDuration(0)).toBe('expired');
    expect(formatDuration(-5_000)).toBe('expired');
  });

  it('shows minutes below an hour', () => {
    expect(formatDuration(5 * 60_000)).toBe('5m');
    expect(formatDuration(59 * 60_000)).toBe('59m');
  });

  it('rounds down so a valid session never reads as 0m', () => {
    expect(formatDuration(59_999)).toBe('0m');
    expect(formatDuration(60_000)).toBe('1m');
  });

  it('shows hours and minutes above an hour', () => {
    expect(formatDuration(60 * 60_000)).toBe('1h 0m');
    expect(formatDuration(135 * 60_000)).toBe('2h 15m');
  });

  it('handles the twelve-hour default session length', () => {
    expect(formatDuration(12 * 60 * 60_000)).toBe('12h 0m');
  });
});
