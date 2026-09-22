import { Logo } from '@/brand/Logo';
import { access } from '@/domain/contract';
import { navigationFor } from '@/domain/navigation';
import { requireActorPage } from '@/core/auth/page-guards';
import { AppShell } from '@/core/ui/shell/AppShell';

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActorPage();
  return (
    <AppShell
      brand={<Logo />}
      navItems={navigationFor(actor)}
      account={{ name: actor.name, roleLabel: access.roleLabel(actor.role), href: '/account' }}
    >
      {children}
    </AppShell>
  );
}
