import { notFound } from 'next/navigation';
import { getEnv } from '@/core/env/env';
import { parseSort } from '@/core/ui/sorting';
import { Gallery } from './Gallery';

export const metadata = { title: 'רכיבים' };

/**
 * The component gallery: every primitive in its states, on one page.
 * Used for design review, the screenshot sweep and the Playwright suite.
 * Never served in production (404), and it renders no business data.
 */
export default async function DesignSystemPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string }> }) {
  if (getEnv().APP_ENV === 'production') notFound();
  const sort = parseSort(await searchParams, ['name', 'dueOn', 'amount'] as const, { key: 'dueOn', dir: 'asc' });
  return <Gallery sort={sort} />;
}
