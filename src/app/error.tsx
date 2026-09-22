'use client';

import { copy } from '@/core/copy';
import { Button } from '@/core/ui/components/Button';

/**
 * Unexpected rendering error. Shows nothing about the cause — the digest is a
 * reference an administrator can match against server logs.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-start justify-center gap-3 px-6">
      <h1 className="heading-title text-title">{copy.errors.unexpected}</h1>
      <p className="text-body text-ink-muted">אם זה חוזר על עצמו, כדאי לפנות למנהל המערכת.</p>
      {error.digest && (
        <p className="text-meta text-ink-subtle">
          מזהה תקלה: <bdi dir="ltr">{error.digest}</bdi>
        </p>
      )}
      <Button variant="primary" onClick={reset} className="mt-2">
        {copy.common.retry}
      </Button>
    </main>
  );
}
