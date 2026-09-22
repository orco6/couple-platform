import { can } from '@/core/access/can';
import { requireActorPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { ResponsiveTable } from '@/core/ui/components/DataTable';
import { ClearFilters, hasActiveFilters } from '@/core/ui/components/ClearFilters';
import { FilterBar, SearchFilter, SelectFilter } from '@/core/ui/components/FilterBar';
import { PageHeader, Toolbar } from '@/core/ui/components/Layout';
import { CursorPagination, LinkTabs } from '@/core/ui/components/Navigation';
import { EmptyState } from '@/core/ui/components/States';
import { StatusBadge } from '@/core/ui/components/StatusBadge';
import { DateText, MoneyText } from '@/core/ui/components/Text';
import { taskLifecycle } from '@/domain/sample/task-lifecycle';
import { DueDate } from '../_components/DueDate';
import { listTasks, taskListQuerySchema } from '@/domain/sample/tasks';

export const metadata = { title: 'משימות' };

const TABS = [
  { value: 'active', label: 'פתוחות' },
  { value: 'DONE', label: 'בוצעו' },
  { value: 'CANCELLED', label: 'בוטלו' },
] as const;

const TASK_FILTERS = ['q', 'assignee'] as const;

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActorPage();
  const raw = await searchParams;
  const parsed = taskListQuerySchema.safeParse({ status: raw.status, assignee: raw.assignee, q: raw.q, cursor: raw.cursor });
  const filters = parsed.success ? parsed.data : {};
  const status = filters.status ?? 'active';
  const seesAll = can(actor, 'tasks.read_all');

  const { tasks, nextCursor } = await listTasks(db, actor, { ...filters, status });

  const keep = (extra: Record<string, string>) =>
    new URLSearchParams(
      Object.entries({ q: filters.q ?? '', assignee: filters.assignee ?? '', status, ...extra }).filter(([, v]) => v && v !== 'active'),
    ).toString();

  return (
    <>
      <PageHeader title="משימות" description={seesAll ? 'כל המשימות בעסק.' : 'משימות שמשויכות אליך או ללקוחות שבאחריותך.'} />
      <LinkTabs
        label="סינון לפי סטטוס"
        tabs={TABS.map((tab) => ({
          href: `/tasks?${new URLSearchParams(Object.entries({ q: filters.q ?? '', assignee: filters.assignee ?? '', status: tab.value === 'active' ? '' : tab.value }).filter(([, v]) => v))}`,
          label: tab.label,
          current: status === tab.value,
        }))}
      />
      <Toolbar
        start={
          <FilterBar>
            <SearchFilter placeholder="חיפוש לפי משימה או לקוח" />
            {seesAll && <SelectFilter name="assignee" label="מבצע" allLabel="כל המבצעים" options={[{ value: 'me', label: 'משויכות אליי' }]} />}
            <ClearFilters pathname="/tasks" params={raw} filters={TASK_FILTERS} />
          </FilterBar>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState
          title="אין משימות להצגה"
          description={
            hasActiveFilters(raw, TASK_FILTERS)
              ? 'אין משימות שמתאימות לסינון בלשונית הזו. אפשר לנקות את הסינון או לעבור ללשונית אחרת.'
              : 'משימה נפתחת מתוך דף הלקוח שהיא שייכת לו, ומופיעה כאן לפי הסטטוס שלה.'
          }
          action={<ClearFilters pathname="/tasks" params={raw} filters={TASK_FILTERS} />}
        />
      ) : (
        <ResponsiveTable
          caption="רשימת משימות"
          rows={tasks}
          rowKey={(task) => task.id}
          rowHref={(task) => `/tasks/${task.id}`}
          columns={[
            { key: 'title', header: 'משימה', cell: (t) => t.title, mobile: 'primary' },
            { key: 'customer', header: 'לקוח', cell: (t) => t.customer.name },
            { key: 'due', header: status === 'DONE' ? 'בוצעה' : 'יעד', cell: (t) => (status === 'DONE' ? <DateText value={t.completedOn} /> : <DueDate task={t} />) },
            ...(seesAll ? [{ key: 'assignee', header: 'מבצע', cell: (t: (typeof tasks)[number]) => t.assignee?.name ?? null }] : []),
            { key: 'price', header: 'כולל מע״מ', numeric: true, mobile: 'end' as const, cell: (t) => (t.price ? <MoneyText value={t.price.gross} /> : null) },
            { key: 'status', header: 'סטטוס', mobile: 'end' as const, cell: (t) => <StatusBadge label={t.statusLabel} tone={taskLifecycle.tone(t.status)} /> },
          ]}
        />
      )}
      <CursorPagination
        firstHref={filters.cursor ? `/tasks?${keep({})}` : null}
        nextHref={nextCursor ? `/tasks?${keep({ cursor: nextCursor })}` : null}
      />
    </>
  );
}
