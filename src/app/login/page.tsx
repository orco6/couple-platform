import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { brand } from '@/brand/brand';
import { Logo } from '@/brand/Logo';
import { getCurrentSession } from '@/core/auth/current';
import { safeRedirectPath } from '@/core/http/safe-redirect';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'כניסה' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next);
  const session = await getCurrentSession();
  if (session) redirect(session.actor.mustChangePassword ? '/change-password' : nextPath);

  return (
    <main className="flex min-h-dvh items-start justify-center px-4 pt-[12vh] sm:items-center sm:pt-0">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8">
          <Logo />
          {brand.tagline && <p className="mt-3 text-body text-ink-muted">{brand.tagline}</p>}
        </div>
        <h1 className="heading-title mb-5 text-title text-ink">כניסה</h1>
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
