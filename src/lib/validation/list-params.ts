/**
 * Pure helpers for offset-paginated list state kept in the URL.
 *
 * No React or Next imports, so the parsing/clamping rules are unit-testable — the
 * "never request more than 100 rows" rule in particular.
 */

export type IsActiveFilter = 'true' | 'false' | 'all';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parseLimit(raw: string | null | undefined): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

export function parseOffset(raw: string | null | undefined): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

/** Defaults to the active-only view, which is what the API does by default. */
export function parseIsActive(raw: string | null | undefined): IsActiveFilter {
  if (raw === 'false' || raw === 'all') {
    return raw;
  }
  return 'true';
}

/** Page number (1-based) for a given offset and page size. */
export function pageFromOffset(offset: number, limit: number): number {
  if (limit <= 0) {
    return 1;
  }
  return Math.floor(offset / limit) + 1;
}
