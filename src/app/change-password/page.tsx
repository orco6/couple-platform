import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/brand/Logo';
import { getCurrentSession } from '@/core/auth/current';
import { ChangePasswordForm } from '@/app/(app)/account/ChangePasswordForm';

export const metadata: Metadata = { title: 'בחירת סיסמה' };

/**
 * The gate for accounts holding a temporary password. Deliberately outside the
 * app shell: until a password is chosen there is nowhere else to go (every page
 * guard and API guard sends the person back here).
 */
export default async function ChangePasswordPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (!session.actor.mustChangePassword) redirect('/account');

  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-[10vh] sm:items-center sm:pt-0">
      <div className="w-full max-w-[24rem]">
        <Logo className="mb-8" />
        <h1 className="text-title font-bold text-ink">בחירת סיסמה אישית</h1>
        <p className="mb-6 mt-1 text-body text-ink-muted">
          שלום {session.actor.name}. הסיסמה הנוכחית היא סיסמה זמנית. יש לבחור סיסמה אישית כדי להמשיך.
        </p>
        <ChangePasswordForm mode="forced" />
      </div>
    </main>
  );
}
