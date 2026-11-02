/**
 * Report date-range policy (pure, unit-tested).
 *
 * The API applies no default window: omitting `from`/`to` scans the whole table. Reports
 * therefore apply their own default of the last N days, with an explicit escape hatch
 * (`range=all`) so the full history is always one click away and never silently hidden.
 */

export const DEFAULT_REPORT_RANGE_DAYS = 30;

export type ReportRangeMode = 'default' | 'all' | 'custom';

export type ReportRange = {
  from?: string;
  to?: string;
  mode: ReportRangeMode;
};

function parseInstant(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  return Number.isNaN(Date.parse(raw)) ? undefined : raw;
}

export function resolveReportRange(
  input: { from?: string | null; to?: string | null; range?: string | null },
  options: { now?: number; defaultDays?: number } = {},
): ReportRange {
  const now = options.now ?? Date.now();
  const days = options.defaultDays ?? DEFAULT_REPORT_RANGE_DAYS;

  if (input.range === 'all') {
    return { mode: 'all' };
  }

  const from = parseInstant(input.from);
  const to = parseInstant(input.to);
  if (from && to) {
    return { mode: 'custom', from, to };
  }

  return {
    mode: 'default',
    from: new Date(now - days * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(now).toISOString(),
  };
}

/** Converts a local-day selection into absolute instants (start/end of those days). */
export function dayBoundsToInstants(start: Date, end: Date): { from: string; to: string } {
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(end);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
