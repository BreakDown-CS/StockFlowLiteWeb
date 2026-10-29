'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { App } from 'antd';

import { SESSION_EXPIRED_EVENT } from '@/lib/api/bff-client';

/**
 * Global session-expiry funnel.
 *
 * Any BFF call that returns 401 dispatches `sf:session-expired`. This component is the
 * single listener, so five parallel requests that all fail produce exactly one redirect
 * (and never a redirect loop, because it navigates once and latches).
 */
export function SessionWatcher() {
  const router = useRouter();
  const { message } = App.useApp();
  const handled = useRef(false);

  useEffect(() => {
    function onExpired() {
      if (handled.current) {
        return;
      }
      handled.current = true;
      message.warning('Your session ended. Please sign in again.');
      router.replace('/login?reason=session_expired');
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [message, router]);

  return null;
}
