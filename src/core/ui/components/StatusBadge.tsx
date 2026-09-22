import { cx } from '@/core/ui/cx';

/**
 * A status label. Text first — the colour is never the only signal — with a
 * small mark whose colour carries the tone.
 *
 * Ordinary states are quiet. `neutral` (the state everything starts in:
 * "open", "scheduled", "draft") and `muted` (finished and no longer
 * interesting: "cancelled") render as plain text with the mark and no chip.
 * Only states that have moved or need attention get a filled chip. A column of
 * identical grey pills saying "open" is noise that teaches people to ignore
 * the one chip that matters (measured in Koma: eight rows, four identical
 * "draft" pills).
 */

export type StatusTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'muted';

const TONE: Record<StatusTone, { mark: string; text: string; chip: string | null }> = {
  neutral: { mark: 'bg-ink-subtle', text: 'text-ink-muted', chip: null },
  active: { mark: 'bg-accent', text: 'text-accent-text', chip: 'bg-accent-tint' },
  success: { mark: 'bg-success', text: 'text-success-text', chip: 'bg-success-tint' },
  warning: { mark: 'bg-warning', text: 'text-warning-text', chip: 'bg-warning-tint' },
  danger: { mark: 'bg-danger', text: 'text-danger-text', chip: 'bg-danger-tint' },
  muted: { mark: 'bg-rule-strong', text: 'text-ink-subtle', chip: null },
};

export function StatusBadge({ label, tone = 'neutral', className }: { label: string; tone?: StatusTone; className?: string }) {
  const style = TONE[tone];
  return (
    <span
      data-tone={tone}
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-meta font-medium',
        style.chip ? cx('rounded-chip px-1.5 py-0.5', style.chip) : 'py-0.5',
        style.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', style.mark)} />
      {label}
    </span>
  );
}
