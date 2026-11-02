import { redirect } from 'next/navigation';

/**
 * Movement report entry point.
 *
 * The ledger screen already *is* the movement report — same endpoint, same filters, plus a
 * summary block — so this route does not duplicate it. It redirects with an explicit
 * 30-day window, which is the report default (the API applies none of its own). The ledger
 * itself keeps showing the full history when opened from the sidebar.
 */
export default function MovementReportPage() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  redirect(
    `/stock-movements?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
  );
}
