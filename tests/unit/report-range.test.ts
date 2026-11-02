import { describe, expect, it } from 'vitest';

import { toRequestReport, toRequestSummary } from '@/features/reports/mappers';
import type { RequestReportDTO } from '@/features/reports/types';
import { dayBoundsToInstants, resolveReportRange } from '@/lib/validation/report-range';

const NOW = Date.parse('2026-10-29T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('resolveReportRange', () => {
  it('defaults to the last 30 days when nothing is specified', () => {
    const range = resolveReportRange({}, { now: NOW });

    expect(range.mode).toBe('default');
    expect(range.from).toBe(new Date(NOW - 30 * DAY).toISOString());
    expect(range.to).toBe(new Date(NOW).toISOString());
  });

  it('respects a custom window', () => {
    const range = resolveReportRange(
      { from: '2026-10-01T00:00:00Z', to: '2026-10-15T00:00:00Z' },
      { now: NOW },
    );

    expect(range.mode).toBe('custom');
    expect(range.from).toBe('2026-10-01T00:00:00Z');
    expect(range.to).toBe('2026-10-15T00:00:00Z');
  });

  it('honours the explicit all-time escape hatch', () => {
    const range = resolveReportRange({ range: 'all' }, { now: NOW });

    expect(range.mode).toBe('all');
    expect(range.from).toBeUndefined();
    expect(range.to).toBeUndefined();
  });

  it('falls back to the default when only one bound is present', () => {
    const range = resolveReportRange({ from: '2026-10-01T00:00:00Z' }, { now: NOW });
    expect(range.mode).toBe('default');
  });

  it('ignores unparsable timestamps', () => {
    const range = resolveReportRange({ from: 'nope', to: 'nope' }, { now: NOW });
    expect(range.mode).toBe('default');
  });

  it('supports a custom default window', () => {
    const range = resolveReportRange({}, { now: NOW, defaultDays: 7 });
    expect(range.from).toBe(new Date(NOW - 7 * DAY).toISOString());
  });
});

describe('dayBoundsToInstants', () => {
  it('expands a day selection to cover both local days fully', () => {
    const { from, to } = dayBoundsToInstants(
      new Date(2026, 9, 1, 13, 45),
      new Date(2026, 9, 3, 9, 15),
    );

    expect(from).toBe(new Date(2026, 9, 1, 0, 0, 0, 0).toISOString());
    expect(to).toBe(new Date(2026, 9, 3, 23, 59, 59, 999).toISOString());
    expect(Date.parse(from)).toBeLessThan(Date.parse(to));
  });
});

const dto: RequestReportDTO = {
  summary: {
    total_requests: 7,
    pending_requests: 2,
    approved_requests: 1,
    rejected_requests: 1,
    issued_requests: 3,
    cancelled_requests: 0,
    requested_units_total: 40,
    issued_units_total: 25,
  },
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      request_number: 'REQ-1',
      status: 'ISSUED',
      requester_id: '22222222-2222-4222-8222-222222222222',
      requester_username: 'admin',
      item_count: 2,
      requested_units: 9,
      issued_units: 9,
      created_at: '2026-10-28T10:00:00Z',
      reviewed_at: '2026-10-28T11:00:00Z',
      issued_at: '2026-10-28T12:00:00Z',
    },
  ],
};

describe('request report mappers', () => {
  it('maps the summary counters', () => {
    expect(toRequestSummary(dto.summary)).toEqual({
      totalRequests: 7,
      pendingRequests: 2,
      approvedRequests: 1,
      rejectedRequests: 1,
      issuedRequests: 3,
      cancelledRequests: 0,
      requestedUnitsTotal: 40,
      issuedUnitsTotal: 25,
    });
  });

  it('maps rows and defaults nullable fields', () => {
    const report = toRequestReport(dto);

    expect(report.items[0]).toMatchObject({
      requestNumber: 'REQ-1',
      requesterUsername: 'admin',
      requestedUnits: 9,
      issuedUnits: 9,
      rejectionReason: '',
      cancellationReason: '',
    });
    expect(report.items[0]?.issuedAt).toBe('2026-10-28T12:00:00Z');
  });

  it('maps a row without review or issuance timestamps', () => {
    const report = toRequestReport({
      ...dto,
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          request_number: 'REQ-2',
          status: 'PENDING',
          requester_id: '22222222-2222-4222-8222-222222222222',
          requester_username: 'admin',
          item_count: 1,
          requested_units: 2,
          issued_units: 0,
          created_at: '2026-10-28T10:00:00Z',
        },
      ],
    });

    expect(report.items[0]?.reviewedAt).toBeNull();
    expect(report.items[0]?.issuedAt).toBeNull();
  });
});
