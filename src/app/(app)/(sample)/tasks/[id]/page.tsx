import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@/core/access/can';
import { requireActorPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { isAppError } from '@/core/errors/errors';
import { listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { formatRate } from '@/core/money/format';
import { DescriptionList, PageHeader, Panel, Section } from '@/core/ui/components/Layout';
import { StatusBadge } from '@/core/ui/components/StatusBadge';
import { DateText, MoneyText } from '@/core/ui/components/Text';
import { listAssignableUsers } from '@/domain/sample/customers';
import { followUpTargets } from '@/domain/follow-ups';
import { taskLifecycle } from '@/domain/sample/task-lifecycle';
import { getTask } from '@/domain/sample/tasks';
import { FollowUpButton } from '@/app/(app)/_components/FollowUpButton';
import { FollowUpList } from '@/app/(app)/_components/FollowUpList';
import { TaskActions } from './TaskActions';
import { DueDate } from '../../_components/DueDate';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorPage();
  const { id } = await params;
  const task = await getTask(db, actor, id).catch(() => null);
  return { title: task ? `${task.title} · ${task.customer.name}` : 'לא נמצא' };
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorPage();
  const { id } = await params;

  const task = await getTask(db, actor, id).catch((error: unknown) => {
    if (isAppError(error) && error.category === 'not_found') notFound();
    throw error;
  });
  const [followUps, assignees] = await Promise.all([
    listOpenFollowUps(db, actor, { entityType: 'task', entityId: id }),
    can(actor, 'tasks.edit_all') ? listAssignableUsers(db) : Promise.resolve(undefined),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/customers/${task.customer.id}`} className="hover:text-ink hover:underline">
            {task.customer.name}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {task.title}
            <StatusBadge label={task.statusLabel} tone={taskLifecycle.tone(task.status)} />
          </span>
        }
        actions={
          <>
            <FollowUpButton entityType="task" entityId={task.id} kinds={followUpTargets.kinds} />
            <TaskActions task={task} assignees={assignees} canPrice={can(actor, 'tasks.set_price')} />
          </>
        }
      />

      <Section title="פרטים">
        <Panel>
          <DescriptionList
            columns={3}
            items={[
              { label: 'מבצע', value: task.assignee?.name ?? '—' },
              { label: 'תאריך יעד', value: <DueDate task={task} /> },
              { label: 'תאריך ביצוע', value: <DateText value={task.completedOn} /> },
            ]}
          />
          {task.description && <p className="rule-t mt-4 whitespace-pre-wrap pt-4 text-body text-ink">{task.description}</p>}
        </Panel>
      </Section>

      <Section title="מחיר">
        {task.price ? (
          <Panel>
            <dl className="grid max-w-sm gap-1.5 text-body">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">לפני מע״מ</dt>
                <dd><MoneyText value={task.price.net} decimals="always" /></dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">מע״מ ({formatRate(task.price.rateBps)})</dt>
                <dd><MoneyText value={task.price.vat} decimals="always" /></dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-rule pt-1.5 font-semibold">
                <dt>סה״כ</dt>
                <dd><MoneyText value={task.price.gross} decimals="always" /></dd>
              </div>
            </dl>
          </Panel>
        ) : (
          <p className="text-body text-ink-subtle">לא נקבע מחיר.</p>
        )}
      </Section>

      {followUps.length > 0 && (
        <Section title="מעקב פתוח">
          <FollowUpList items={followUps} kinds={followUpTargets.kinds} />
        </Section>
      )}
    </>
  );
}
