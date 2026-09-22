/**
 * Inline SVG icons (1.6px stroke, 24px grid). A small, deliberate set instead of
 * an icon library: no bundle weight, and nothing decorative sneaks in.
 *
 * Direction: icons that point along the reading direction (chevrons, arrows)
 * carry `data-directional` and are mirrored in RTL by the `rtl:-scale-x-100`
 * class. Icons that depict objects (calendar, eye, printer) are never mirrored.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { directional?: boolean };

function Icon({ children, className = 'size-5', directional, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`${className}${directional ? ' rtl:-scale-x-100' : ''}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
/** Points toward the END of the reading direction (left in RTL). */
export const ChevronForwardIcon = (p: IconProps) => <Icon directional {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const ChevronBackIcon = (p: IconProps) => <Icon directional {...p}><path d="m15 6-6 6 6 6" /></Icon>;
/** Physical directions, never mirrored — for chronology (older ← → newer), which runs left to right even in RTL. */
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const CheckIcon =(p: IconProps) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
export const EyeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></Icon>
);
export const EyeOffIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.3 6.8C3.9 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1M9.9 9.9a2.8 2.8 0 0 0 4 4" /></Icon>
);
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Icon>
);
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const PrintIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 9V3.5h10V9M7 17.5H4.5v-7a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v7H17" /><path d="M7 14h10v6.5H7z" /></Icon>
);
export const HomeIcon = (p: IconProps) => <Icon {...p}><path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" /></Icon>;
export const UsersIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 5.2a3.4 3.4 0 0 1 0 6.6M18 14.8c2 .7 3.2 2.5 3.5 5.2" /></Icon>
);
export const ListIcon = (p: IconProps) => <Icon {...p}><path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></Icon>;
export const FlagIcon = (p: IconProps) => <Icon {...p}><path d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5" /></Icon>;
export const ChartIcon = (p: IconProps) => <Icon {...p}><path d="M4 20V4M4 20h16M8.5 16v-4M13 16V8M17.5 16v-6" /></Icon>;
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3.9 2-3.4z" /></Icon>
);
export const ArchiveIcon = (p: IconProps) => <Icon {...p}><path d="M3.5 5h17v4h-17zM5 9v10.5h14V9M10 13h4" /></Icon>;
export const HistoryIcon = (p: IconProps) => <Icon {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 7.5V12l3 2" /></Icon>;
export const MenuIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const SignOutIcon = (p: IconProps) => <Icon directional {...p}><path d="M14 4.5h4.5v15H14M10 8l-4 4 4 4M6 12h9" /></Icon>;
export const UserIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c.8-3.7 3.7-6 7.5-6s6.7 2.3 7.5 6" /></Icon>;
export const AlertIcon = (p: IconProps) => <Icon {...p}><path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2h.01" /></Icon>;
export const InfoIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" /></Icon>;
export const LayersIcon = (p: IconProps) => <Icon {...p}><path d="m12 4 8.5 4.5L12 13 3.5 8.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></Icon>;
