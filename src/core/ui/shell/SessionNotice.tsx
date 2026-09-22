'use client';

import { useEffect, useState } from 'react';
import { copy } from '@/core/copy';
import { SESSION_ENDED_EVENT } from '@/core/http/client';

/**
 * Shown when a save was refused because the session ended.
 *
 * The form stays on screen with what was typed. This notice offers sign-in in a
 * NEW tab (the session cookie is shared), and when the person comes back to
 * this tab it checks the session and says they can save again. Redirecting to
 * the sign-in page instead — what both reference apps did — loses the input.
 */
export function SessionNotice() {
  const [state, setState] = useState<'hidden' | 'ended' | 'restored'>('hidden');

  useEffect(() => {
    const onEnded = () => setState('ended');
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, []);

  useEffect(() => {
    if (state !== 'ended') return;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const response = await fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).catch(() => null);
      if (response?.ok) setState('restored');
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [state]);

  useEffect(() => {
    if (state !== 'restored') return;
    const timer = window.setTimeout(() => setState('hidden'), 6000);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state === 'hidden') return null;

  return (
    <div
      role={state === 'ended' ? 'alert' : 'status'}
      data-testid="session-notice"
      className="print-hide fixed inset-x-0 top-0 z-[60] border-b border-rule bg-surface px-4 py-3 shadow-[var(--shadow-raised)]"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-body text-ink">{state === 'ended' ? copy.errors.sessionEndedNotice : copy.errors.sessionRestored}</p>
        {state === 'ended' && (
          <a
            href="/login?next=/"
            target="_blank"
            rel="noopener"
            className="shrink-0 text-body font-semibold text-accent-text underline underline-offset-2"
          >
            {copy.errors.sessionEndedSignIn}
          </a>
        )}
      </div>
    </div>
  );
}
