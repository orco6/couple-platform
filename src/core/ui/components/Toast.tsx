'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { copy } from '@/core/copy';
import { cx } from '@/core/ui/cx';
import { CheckIcon, CloseIcon, InfoIcon, AlertIcon } from './Icons';

/**
 * Toasts: short confirmation that something happened ("הלקוח נשמר").
 *
 * Not for errors a person must act on — those belong next to the thing that
 * failed (field errors, a form error). A toast is announced politely to screen
 * readers, stays long enough to read (5s, paused on hover/focus), and never
 * covers the mobile navigation.
 */

type Tone = 'success' | 'info' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const show = useCallback((message: string, tone: Tone = 'success') => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-2), { id, message, tone }]);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(item.id), 5000);
    return () => window.clearTimeout(timer);
  }, [paused, item.id, onDismiss]);

  const Icon = item.tone === 'success' ? CheckIcon : item.tone === 'error' ? AlertIcon : InfoIcon;

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-control bg-inverse py-2.5 pe-2 ps-4 text-body text-on-inverse shadow-[var(--shadow-overlay)]"
    >
      <Icon className={cx('size-5 shrink-0', item.tone === 'error' ? 'text-on-inverse-danger' : 'text-on-inverse-success')} />
      <span className="min-w-0 flex-1">{item.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={copy.common.close}
        className="flex size-9 items-center justify-center rounded-control text-on-inverse-muted hover:text-on-inverse"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
