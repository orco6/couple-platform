import { ButtonLink } from '@/core/ui/components/ButtonLink';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 px-6">
      <p className="text-meta font-semibold text-ink-subtle">404</p>
      <h1 className="heading-title text-title">הדף לא נמצא</h1>
      <p className="text-body text-ink-muted">ייתכן שהקישור שגוי, שהפריט הועבר לארכיון, או שאין הרשאה לצפות בו.</p>
      <ButtonLink href="/" variant="primary" className="mt-2">
        חזרה לדף הבית
      </ButtonLink>
    </main>
  );
}
