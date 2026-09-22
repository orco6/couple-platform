import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can } from '@/core/access/can';
import { requireActorPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { isAppError } from '@/core/errors/errors';
import { listOpenFollowUps } from '@/core/follow-ups/follow-ups';
import { ResponsiveTable } from '@/core/ui/components/DataTable';
import { DescriptionList, PageHeader, Panel, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { StatusBadge } from '@/core/ui/components/StatusBadge';
import { EmailLink, MoneyText, PhoneLink } from '@/core/ui/components/Text';
import { getCustomer, listAssignableUsers } from '@/domain/sample/customers';
import { followUpTargets } from '@/domain/follow-ups';
import { listNotes } from '@/domain/sample/notes';
import { taskLifecycle } from '@/domain/sample/task-lifecycle';
import { listTasksForCustomer } from '@/domain/sample/tasks';
import { FollowUpButton } from '@/app/(app)/_components/FollowUpButton';
import { FollowUpList } from '@/app/(app)/_components/FollowUpList';
import { NewTaskButton } from '../../tasks/TaskFormDialog';
import { CustomerActions } from './CustomerActions';
import { NotesPanel } from './NotesPanel';
import { DueDate } from '../../_components/DueDate';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorPage();
  const { id } = await params;
  // Out of scope or missing: the same neutral title as the not-found screen (reveals nothing).
  const customer = await getCustomer(db, actor, id).catch(() => null);
  return { title: customer ? customer.name : 'לא נמצא' };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActorPage();
  const { id } = await params;

  const customer = await getCustomer(db, actor, id).catch((error: unknown) => {
    if (isAppError(error) && error.category === 'not_found') notFound();
    throw error;
  });

  const [tasks, notes, followUps, users] = await Promise.all([
    listTasksForCustomer(db, actor, id),
    listNotes(db, actor, id),
    listOpenFollowUps(db, actor, { entityType: 'customer', entityId: id }),
    can(actor, 'customers.edit_all') || can(actor, 'tasks.edit_all') ? listAssignableUsers(db) : Promise.resolve(undefined),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/customers" className="hover:text-ink hover:underline">לקוחות</Link>}
        title={customer.name}
        description={`באחריות ${customer.owner.name}`}
        actions={
          <>
            <FollowUpButton entityType="customer" entityId={customer.id} kinds={followUpTargets.kinds} />
            <CustomerActions customer={customer} owners={users} />
          </>
        }
      />

      <Section title="פרטים">
        <Panel>
          <DescriptionList
            columns={3}
            items={[
              { label: 'טלפון', value: <PhoneLink value={customer.phone} /> },
              { label: 'דוא״ל', value: <EmailLink value={customer.email} /> },
              { label: 'עיר', value: customer.city ?? '—' },
            ]}
          />
        </Panel>
      </Section>

      {followUps.length > 0 && (
        <Section title="מעקב פתוח">
          <FollowUpList items={followUps} kinds={followUpTargets.kinds} />
        </Section>
      )}

      <Section
        title="משימות"
        actions={can(actor, 'tasks.create') ? <NewTaskButton customerId={customer.id} assignees={can(actor, 'tasks.edit_all') ? users : undefined} canPrice={can(actor, 'tasks.set_price')} /> : undefined}
      >
        {tasks.length === 0 ? (
          <EmptyState title="אין משימות ללקוח הזה" description="עבודה שמתבצעת עבור הלקוח נרשמת כמשימה, עם תאריך יעד ומחיר. היא תופיע כאן ובדוח ההכנסות כשתסומן כבוצעה." />
        ) : (
          <ResponsiveTable
            caption={`משימות של ${customer.name}`}
            rows={tasks}
            rowKey={(task) => task.id}
            rowHref={(task) => `/tasks/${task.id}`}
            columns={[
              { key: 'title', header: 'משימה', cell: (t) => t.title, mobile: 'primary' },
              { key: 'assignee', header: 'מבצע', cell: (t) => t.assignee?.name ?? null },
              { key: 'due', header: 'יעד', cell: (t) => <DueDate task={t} /> },
              { key: 'price', header: 'מחיר כולל מע״מ', numeric: true, mobile: 'end', cell: (t) => (t.price ? <MoneyText value={t.price.gross} /> : null) },
              { key: 'status', header: 'סטטוס', mobile: 'end', cell: (t) => <StatusBadge label={t.statusLabel} tone={taskLifecycle.tone(t.status)} /> },
            ]}
          />
        )}
      </Section>

      <Section title="הערות">
        <NotesPanel customerId={customer.id} notes={notes} canAdd={customer.permissions.edit} />
      </Section>
    </>
  );
}
