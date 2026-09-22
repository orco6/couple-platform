import Link from 'next/link';
import { requireActorPage } from '@/core/auth/page-guards';
import { formatCalendarDate, todayIn } from '@/core/dates/calendar-date';
import { db } from '@/core/db/client';
import { runAttentionRules } from '@/core/follow-ups/attention';
import { listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { cx } from '@/core/ui/cx';
import { ResponsiveTable } from '@/core/ui/components/DataTable';
import { ChevronForwardIcon } from '@/core/ui/components/Icons';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { StatusBadge } from '@/core/ui/components/StatusBadge';
import { DueDate } from './(sample)/_components/DueDate';
import { attentionRules } from '@/domain/attention';
import { listTasks } from '@/domain/sample/tasks';
import { taskLifecycle } from '@/domain/sample/task-lifecycle';

export const metadata = { title: 'היום' };

const SEVERITY_MARK = { urgent: 'bg-danger', attention: 'bg-warning', info: 'bg-rule-strong' } as const;

export default async function TodayPage() {
  const actor = await requireActorPage();
  const [groups, followUps, myTasks] = await Promise.all([
    runAttentionRules(db, actor, attentionRules, 3),
    listOpenFollowUps(db, actor, { limit: 5 }),
    listTasks(db, actor, { status: 'active', assignee: 'me' }),
  ]);

  const attentionTotal = groups.reduce((sum, group) => sum + group.total, 0) + followUps.length;

  return (
    <>
      <PageHeader title="היום" description={<bdi dir="ltr">{formatCalendarDate(todayIn())}</bdi>} />

      <Section
        title="דורש תשומת לב"
        actions={
          attentionTotal > 0 ? (
            <Link href="/attention" className="text-body font-medium text-accent-text hover:underline">
              לכל הרשימה
            </Link>
          ) : undefined
        }
      >
        {attentionTotal === 0 ? (
          <p className="rounded-surface bg-sunken px-4 py-3 text-body text-ink-muted">אין כרגע דבר שממתין לטיפול.</p>
        ) : (
          <ul className="surface divide-y divide-rule-faint">
            {groups.map((group) => (
              <li key={group.key}>
                <Link href={`/attention#${group.key}`} className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-hover">
                  <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', SEVERITY_MARK[group.severity])} />
                  <span className="min-w-0 flex-1 text-row text-ink">{group.label}</span>
                  <span className="tnum text-row font-semibold text-ink">{group.total}</span>
                  <ChevronForwardIcon className="size-4 text-ink-subtle" />
                </Link>
              </li>
            ))}
            {followUps.length > 0 && (
              <li>
                <Link href="/attention#follow-ups" className="flex min-h-12 items-center gap-3 px-4 py-2.5 hover:bg-hover">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1 text-row text-ink">פריטי מעקב פתוחים</span>
                  <span className="tnum text-row font-semibold text-ink">{followUps.length}</span>
                  <ChevronForwardIcon className="size-4 text-ink-subtle" />
                </Link>
              </li>
            )}
          </ul>
        )}
      </Section>

      <Section title="המשימות שלי">
        {myTasks.tasks.length === 0 ? (
          <EmptyState title="אין משימות פתוחות שמשויכות אליך" description="משימה שתשויך אליך תופיע כאן עם תאריך היעד שלה, כך שאפשר לראות מה צריך לעשות היום." />
        ) : (
          <ResponsiveTable
            caption="המשימות הפתוחות שלי"
            rows={myTasks.tasks.slice(0, 10)}
            rowKey={(task) => task.id}
            rowHref={(task) => `/tasks/${task.id}`}
            columns={[
              { key: 'title', header: 'משימה', cell: (task) => task.title, mobile: 'primary' },
              { key: 'customer', header: 'לקוח', cell: (task) => task.customer.name },
              { key: 'due', header: 'יעד', cell: (task) => <DueDate task={task} /> },
              {
                key: 'status',
                header: 'סטטוס',
                cell: (task) => <StatusBadge label={task.statusLabel} tone={taskLifecycle.tone(task.status)} />,
                mobile: 'end',
              },
            ]}
          />
        )}
      </Section>
    </>
  );
}
