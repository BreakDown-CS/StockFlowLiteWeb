/**
 * Date/time helpers (pure, unit-tested, no React or antd imports).
 *
 * The API always sends RFC3339 UTC instants; formatting happens at render time only.
 */

/** Milliseconds until an ISO instant, or null when there is no usable value. */
export function remainingMsUntil(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) {
    return null;
  }
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) {
    return null;
  }
  return target - now;
}

/**
 * Compact duration label: `5m`, `2h 15m`, `expired`.
 * Rounds down, so "0m" never appears next to a still-valid session.
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return 'expired';
  }
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
}
