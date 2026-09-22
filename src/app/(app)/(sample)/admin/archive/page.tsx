import Link from 'next/link';
import { can } from '@/core/access/can';
import { requirePermissionPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { DateTimeText } from '@/core/ui/components/Text';
import { listArchivedCustomers } from '@/domain/sample/customers';
import { listArchivedTasks } from '@/domain/sample/tasks';
import { RestoreButton } from './RestoreButton';

export const metadata = { title: 'ארכיון' };

export default async function ArchivePage() {
  const actor = await requirePermissionPage('archive.read');
  const [customers, tasks] = await Promise.all([listArchivedCustomers(db, actor), listArchivedTasks(db, actor)]);

  return (
    <>
      <PageHeader title="ארכיון" description="רשומות שהוסרו מהרשימות הפעילות. שום דבר כאן לא נמחק; שחזור מחייב סיבה ונרשם ביומן." />

      <Section title="לקוחות">
        {customers.length === 0 ? (
          <EmptyState title="אין לקוחות בארכיון" description="לקוח שמועבר לארכיון יורד מהרשימות ומופיע כאן. אפשר לשחזר אותו עם סיבה, וההיסטוריה שלו נשמרת." />
        ) : (
          <ul className="surface divide-y divide-rule-faint">
            {customers.map((customer) => (
              <li key={customer.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-row font-medium">{customer.name}</p>
                  <p className="text-label text-ink-muted">
                    הועבר על ידי {customer.archivedByName ?? '—'}, {customer.archivedAt && <DateTimeText value={customer.archivedAt} />}
                    {customer.archiveReason ? ` · ${customer.archiveReason}` : ''}
                  </p>
                </div>
                {can(actor, 'customers.archive') && <RestoreButton url={`/api/customers/${customer.id}/restore`} label={customer.name} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="משימות">
        {tasks.length === 0 ? (
          <EmptyState title="אין משימות בארכיון" description="משימה שמועברת לארכיון מופיעה כאן, ואפשר לשחזר אותה עם סיבה." />
        ) : (
          <ul className="surface divide-y divide-rule-faint">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-row font-medium">{task.title}</p>
                  <p className="text-label text-ink-muted">
                    <Link href={`/customers/${task.customer.id}`} className="hover:underline">{task.customer.name}</Link> · {task.statusLabel} · הועברה על ידי{' '}
                    {task.archivedByName ?? '—'}
                  </p>
                </div>
                {can(actor, 'tasks.archive') && <RestoreButton url={`/api/tasks/${task.id}/restore`} label={task.title} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
