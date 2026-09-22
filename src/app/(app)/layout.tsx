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
      {/* The lit background, behind everything and inert. It is why the cards
          in here need so little decoration of their own (brand/theme.css). */}
      <div className="aurora" aria-hidden="true" />
      {children}
    </AppShell>
  );
}
