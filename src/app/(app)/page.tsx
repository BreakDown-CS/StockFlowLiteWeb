import type { Metadata } from 'next';

import { DashboardView } from '@/features/dashboard/components/DashboardView';

export const metadata: Metadata = {
  title: 'Dashboard',
};

/** Dashboard route. All data comes from the BFF (`/api/bff/reports/inventory`). */
export default function DashboardPage() {
  return <DashboardView />;
}
