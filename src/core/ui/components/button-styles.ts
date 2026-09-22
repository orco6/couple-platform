import { cx } from '@/core/ui/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-rule-strong hover:bg-hover',
  quiet: 'bg-transparent text-ink-muted border border-transparent hover:bg-hover hover:text-ink',
  danger: 'bg-danger text-white border border-transparent hover:brightness-95',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-body gap-1.5',
  md: 'min-h-11 px-4 text-row gap-2',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cx(
    'relative inline-flex select-none items-center justify-center whitespace-nowrap rounded-control font-medium touch-manipulation',
    // Press lands in 40ms, release eases back over 200ms. A symmetric transition never reaches
    // its pressed scale during a real 80-120ms tap, so the press does not register (measured in
    // Koma; a React Native Pressable swaps its pressed style instantly for the same reason).
    'transition-[background-color,border-color,color,transform,filter] duration-200 ease-out',
    'active:scale-[0.97] active:duration-[40ms] motion-reduce:active:scale-100 motion-reduce:transition-none',
    'disabled:opacity-55 disabled:active:scale-100 aria-busy:cursor-progress aria-busy:active:scale-100',
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

