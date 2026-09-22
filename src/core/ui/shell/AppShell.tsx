import Link from 'next/link';
import type { ReactNode } from 'react';
import { copy } from '@/core/copy';
import type { NavItem } from './nav-types';
import { MobileNav, SideNav, SignOutButton } from './NavLinks';
import { RouteSettle } from './RouteSettle';
import { SessionNotice } from './SessionNotice';

/**
 * The signed-in application frame.
 *
 *   ≥ 768px  a fixed sidebar at the inline START (right in RTL) with the brand,
 *            grouped navigation, and the account at the bottom.
 *   < 768px  a slim top bar (brand + account link) and a bottom tab bar within
 *            thumb reach; everything else lives in the "more" sheet.
 *
 * Content is capped at a readable width and never scrolls sideways.
 */
export function AppShell({
  brand,
  navItems,
  account,
  children,
}: {
  brand: ReactNode;
  navItems: NavItem[];
  account: { name: string; roleLabel: string; href: string };
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-3 py-2 text-body font-semibold focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {copy.common.skipToContent}
      </a>

      <aside
        data-app-chrome
        className="fixed inset-y-0 start-0 z-20 hidden w-60 flex-col border-e border-rule bg-chrome md:flex"
      >
        <div className="flex h-16 items-center px-5">
          <Link href="/" className="flex items-center gap-2.5">
            {brand}
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <SideNav items={navItems} />
        </div>
        <div className="border-t border-rule-faint p-3">
          <Link href={account.href} className="block rounded-control px-3 py-2 hover:bg-hover">
            <span className="block truncate text-body font-semibold text-ink">{account.name}</span>
            <span className="block text-meta text-ink-subtle">{account.roleLabel}</span>
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <header
        data-app-chrome
        className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-rule bg-chrome/95 px-4 backdrop-blur-sm md:hidden"
      >
        <Link href="/" className="flex items-center gap-2">
          {brand}
        </Link>
        <Link href={account.href} className="max-w-[45%] truncate text-body text-ink-muted">
          {account.name}
        </Link>
      </header>

      <main id="main" tabIndex={-1} className="pb-28 md:ms-60 md:pb-12">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 md:pt-8 lg:px-10">
          <RouteSettle>{children}</RouteSettle>
        </div>
      </main>

      <MobileNav items={navItems} accountName={account.name} accountRole={account.roleLabel} />
      <SessionNotice />
    </div>
  );
}
