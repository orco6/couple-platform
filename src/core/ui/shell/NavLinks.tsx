'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import { copy } from '@/core/copy';
import { apiRequest } from '@/core/http/client';
import { navigateAfterSessionChange } from '@/core/http/navigation';
import { cx } from '@/core/ui/cx';
import { BottomSheet } from '@/core/ui/components/Dialog';
import {
  ArchiveIcon,
  ChartIcon,
  FlagIcon,
  HistoryIcon,
  HomeIcon,
  LayersIcon,
  ListIcon,
  MenuIcon,
  SettingsIcon,
  SignOutIcon,
  UserIcon,
  UsersIcon,
} from '@/core/ui/components/Icons';
import type { NavIconName, NavItem } from './nav-types';

const ICONS: Record<NavIconName, (props: { className?: string }) => React.ReactNode> = {
  home: HomeIcon,
  users: UsersIcon,
  list: ListIcon,
  flag: FlagIcon,
  chart: ChartIcon,
  settings: SettingsIcon,
  archive: ArchiveIcon,
  history: HistoryIcon,
  user: UserIcon,
  layers: LayersIcon,
};

function matches(pathname: string, href: string, prefix: boolean): boolean {
  if (href === '/') return pathname === '/';
  return prefix ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}

function isActive(pathname: string, item: NavItem): boolean {
  const prefix = item.matchPrefix !== false;
  return [item.href, ...(item.alsoActiveOn ?? [])].some((href) => matches(pathname, href, prefix));
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups = new Map<string, NavItem[]>();
  for (const item of items) {
    const key = item.group ?? '';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-5">
      {[...groups.entries()].map(([group, groupItems]) => (
        <div key={group || 'main'}>
          {group && <p className="mb-1 px-3 text-micro font-semibold text-ink-subtle">{group}</p>}
          <ul className="space-y-0.5">
            {groupItems.map((item) => {
              const active = isActive(pathname, item);
              const Icon = ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative flex min-h-10 items-center gap-2.5 rounded-control px-3 text-body transition-colors duration-[var(--motion-feedback)]',
                      active ? 'bg-selected font-semibold text-ink' : 'text-ink-muted hover:bg-hover hover:text-ink',
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-accent" />}
                    <Icon className={cx('size-[1.15rem] shrink-0', active ? 'text-accent' : 'text-ink-subtle')} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await apiRequest('/api/auth/logout', { method: 'POST' });
        } finally {
          navigateAfterSessionChange('/login');
        }
      }}
      className={cx(
        'flex min-h-10 w-full items-center gap-2.5 rounded-control px-3 text-body text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-60',
        className,
      )}
    >
      <SignOutIcon className="size-[1.15rem] text-ink-subtle" />
      {copy.common.signOut}
    </button>
  );
}

/**
 * Bottom tab bar on phones: up to four destinations plus "more".
 *
 * A tapped tab is marked `data-pending` at once, before the next screen has
 * arrived: navigation keeps the current screen until the new one is ready
 * (ADR 0014), so the tab itself has to say "heard you" within a frame, the way
 * a native tab bar does. The mark clears when the pathname changes.
 */
export function MobileNav({ items, accountName, accountRole }: { items: NavItem[]; accountName: string; accountRole: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Focus goes INTO the sheet (for keyboards and screen readers) but onto the
  // list itself, not its first link: after a tap, a ring on an item nobody
  // chose reads as a selection.
  const moreList = useRef<HTMLUListElement>(null);
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  // Render-phase reset, not an effect: once the route has moved, nothing is pending.
  if (pending && pending.from !== pathname) setPending(null);
  const bar = items.filter((item) => item.mobile === 'bar').slice(0, 4);
  const more = items.filter((item) => !bar.includes(item));
  const moreActive = more.some((item) => isActive(pathname, item));

  const tabClass = (active: boolean) =>
    cx(
      'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-micro touch-manipulation',
      active ? 'font-semibold text-accent-text' : 'text-ink-subtle',
    );

  return (
    <>
      <nav
        aria-label="ניווט ראשי"
        data-app-chrome
        data-mobile-tab-bar
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-chrome/95 backdrop-blur-sm md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {bar.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <li key={item.href} className="flex flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  data-pending={!active && pending?.href === item.href ? '' : undefined}
                  onClick={() => {
                    if (!active) setPending({ href: item.href, from: pathname });
                  }}
                  className={tabClass(pending ? pending.href === item.href : active)}
                >
                  <Icon className="size-6" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
              className={tabClass(moreActive)}
            >
              <MenuIcon className="size-6" />
              {copy.common.more}
            </button>
          </li>
        </ul>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={accountName} description={accountRole} testId="mobile-more-sheet" initialFocus={moreList}>
        <ul ref={moreList} tabIndex={-1} className="-mx-2 space-y-0.5 outline-none">
          {more.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex min-h-12 items-center gap-3 rounded-control px-3 text-row',
                    active ? 'bg-selected font-semibold' : 'text-ink hover:bg-hover',
                  )}
                >
                  <Icon className="size-5 text-ink-subtle" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="-mx-2 mt-2 border-t border-rule-faint pt-2">
          <SignOutButton className="min-h-12 text-row" />
        </div>
      </BottomSheet>
    </>
  );
}
