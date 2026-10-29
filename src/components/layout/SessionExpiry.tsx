'use client';

import { useEffect, useState } from 'react';
import { Alert, Tag } from 'antd';

import { formatDuration, remainingMsUntil } from '@/lib/format/datetime';

/** Warning threshold: the session must be announced before it disappears. */
export const EXPIRY_WARNING_MS = 5 * 60 * 1000;

/**
 * Re-renders once every 30 seconds so the countdown stays roughly accurate.
 *
 * The remaining time is computed during render (cheap) and the interval only forces a
 * re-render. Calling setState synchronously inside an effect would trigger React 19's
 * cascading-render lint rule and an extra commit per mount.
 */
function useRemaining(expiresAt: string | null): number | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  return remainingMsUntil(expiresAt);
}

/** Header badge: always shows how long the session has left. */
export function SessionExpiryTag({ expiresAt }: { expiresAt: string | null }) {
  const remaining = useRemaining(expiresAt);

  if (remaining === null) {
    return null;
  }

  const urgent = remaining <= EXPIRY_WARNING_MS;
  return (
    <Tag color={urgent ? 'red' : 'default'} title="Time left on your current session">
      Session: {formatDuration(remaining)}
    </Tag>
  );
}

/** Banner shown only inside the last five minutes. */
export function SessionExpiryBanner({ expiresAt }: { expiresAt: string | null }) {
  const remaining = useRemaining(expiresAt);

  if (remaining === null || remaining > EXPIRY_WARNING_MS) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      message={`Your session ends in ${formatDuration(Math.max(remaining, 0))}`}
      description="Save any work in progress and sign in again to continue. Sessions cannot be extended."
    />
  );
}
