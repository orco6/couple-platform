import { cx } from '@/core/ui/cx';

/**
 * The column every couple screen lives in.
 *
 * This product is mobile-first and its content is one thing at a time, so on a
 * desktop it stays a phone-shaped column rather than stretching a task card to
 * 1400px. The foundation's shell gives full width because an operational tool
 * wants it; here it would make every row a long walk for the eye.
 */
export function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('mx-auto w-full max-w-xl', className)}>{children}</div>;
}
