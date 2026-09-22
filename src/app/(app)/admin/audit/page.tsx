import { auditVocabulary } from '@/domain/contract';
import { requirePermissionPage } from '@/core/auth/page-guards';
import { auditQuerySchema, listAuditEvents } from '@/core/audit/query';
import { db } from '@/core/db/client';
import { ClearFilters } from '@/core/ui/components/ClearFilters';
import { FilterBar, SelectFilter } from '@/core/ui/components/FilterBar';
import { PageHeader, Toolbar } from '@/core/ui/components/Layout';
import { CursorPagination } from '@/core/ui/components/Navigation';
import { EmptyState } from '@/core/ui/components/States';
import { DateTimeText } from '@/core/ui/components/Text';

export const metadata = { title: 'יומן פעולות' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requirePermissionPage('audit.read');
  const raw = await searchParams;
  const parsed = auditQuerySchema.safeParse({ entityType: raw.entityType || undefined, cursor: raw.cursor || undefined });
  const query = parsed.success ? parsed.data : {};
  const { entries, nextCursor } = await listAuditEvents(db, actor, query);
  const keep = new URLSearchParams(query.entityType ? { entityType: query.entityType } : {});

  return (
    <>
      <PageHeader title="יומן פעולות" description="רישום של מי עשה מה ומתי. היומן אינו ניתן לעריכה או למחיקה." />
      <Toolbar
        start={
          <FilterBar>
            <SelectFilter
              name="entityType"
              label="סוג רשומה"
              allLabel="כל הרשומות"
              options={Object.entries(auditVocabulary.entityTypes).map(([value, label]) => ({ value, label }))}
            />
          </FilterBar>
        }
      />
      {entries.length === 0 ? (
        <EmptyState
          title="אין פעולות להצגה"
          description="כל שינוי שנשמר במערכת נרשם כאן: מי, מתי ומה השתנה. אם בחרת סוג רשומה, אפשר לנקות את הסינון."
          action={<ClearFilters pathname="/admin/audit" params={{ entityType: query.entityType }} filters={['entityType']} />}
        />
      ) : (
        <ol className="surface divide-y divide-rule-faint">
          {entries.map((entry) => (
            <li key={entry.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
              <span className="text-meta text-ink-subtle">
                <DateTimeText value={entry.occurredAt} />
              </span>
              <div className="min-w-0">
                <p className="text-row text-ink">
                  <span className="font-medium">{entry.actorLabel}</span>
                  <span className="text-ink-muted"> · {entry.actionLabel}</span>
                  <span className="text-meta text-ink-subtle"> · {entry.entityLabel}</span>
                </p>
                {entry.summary && <p className="mt-0.5 break-words text-label text-ink-muted">{entry.summary}</p>}
                {entry.reason && <p className="mt-0.5 text-label text-ink">סיבה: {entry.reason}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <CursorPagination
        firstHref={query.cursor ? `/admin/audit?${keep}` : null}
        nextHref={nextCursor ? `/admin/audit?${new URLSearchParams([...keep, ['cursor', nextCursor]])}` : null}
      />
    </>
  );
}
