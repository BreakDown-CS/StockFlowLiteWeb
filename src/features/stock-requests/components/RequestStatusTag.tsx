'use client';

import { Tag } from 'antd';

import type { RequestStatus } from '../types';

const COLORS: Record<RequestStatus, string> = {
  PENDING: 'gold',
  APPROVED: 'blue',
  REJECTED: 'red',
  ISSUED: 'green',
  CANCELLED: 'default',
};

/** Status pill shared by the list and the detail screen. */
export function RequestStatusTag({ status }: { status: RequestStatus }) {
  return <Tag color={COLORS[status]}>{status}</Tag>;
}
