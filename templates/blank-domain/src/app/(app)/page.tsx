import Link from 'next/link';
import { requireActorPage } from '@/core/auth/page-guards';
import { formatCalendarDate, todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { runAttentionRules } from '@/core/follow-ups/attention';
import { listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { attentionRules } from '@/domain/attention';

export const metadata = { title: 'היום' };

/**
 * HOME FOR THIS BUSINESS — replace per project.
 *
 * Answer "what do I need to do today?" for the signed-in role: the records that
 * need attention and the person's own open work. Not charts for their own sake.
 */
export default async function TodayPage() {
  const actor = await requireActorPage();
  const [groups, followUps] = await Promise.all([runAttentionRules(db, actor, attentionRules, 3), listOpenFollowUps(db, actor, { limit: 5 })]);
  const total = groups.reduce((sum, group) => sum + group.total, 0) + followUps.length;

  return (
    <>
      <PageHeader title="היום" description={<bdi dir="ltr">{formatCalendarDate(todayIn())}</bdi>} />
      <Section title="דורש תשומת לב">
        {total === 0 ? (
          <p className="rounded-surface bg-sunken px-4 py-3 text-body text-ink-muted">אין כרגע דבר שממתין לטיפול.</p>
        ) : (
          <Link href="/attention" className="text-body font-medium text-accent-text hover:underline">
            {total} פריטים ממתינים לטיפול
          </Link>
        )}
      </Section>
    </>
  );
}
