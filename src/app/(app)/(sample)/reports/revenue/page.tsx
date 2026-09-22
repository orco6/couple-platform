import Link from 'next/link';
import { can } from '@/core/access/can';
import { requirePermissionPage } from '@/core/auth/page-guards';
import { addMonths, comparePeriods, currentPeriod, formatPeriod, parsePeriodKey, periodKey } from '@/core/dates/period';
import { db } from '@/core/db/client';
import { ButtonLink } from '@/core/ui/components/ButtonLink';
import { ChevronBackIcon, ChevronForwardIcon, PrintIcon } from '@/core/ui/components/Icons';
import { PageHeader, Section } from '@/core/ui/components/Layout';
import { EmptyState } from '@/core/ui/components/States';
import { StatusBadge } from '@/core/ui/components/StatusBadge';
import { DateTimeText, MoneyText } from '@/core/ui/components/Text';
import { getRevenueReport } from '@/domain/sample/revenue';
import { PeriodControls } from './PeriodControls';

export const metadata = { title: 'הכנסות' };

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const actor = await requirePermissionPage('reports.revenue');
  const { period: rawPeriod } = await searchParams;
  const now = currentPeriod();
  const period = parsePeriodKey(rawPeriod) ?? now;
  const report = await getRevenueReport(db, actor, period);
  const previous = addMonths(period, -1);
  const next = addMonths(period, 1);
  const canGoForward = comparePeriods(next, now) <= 0;

  return (
    <>
      <PageHeader
        title="הכנסות"
        description="משימות שבוצעו בחודש, לפי תאריך הביצוע. מחירים לפי שיעור המע״מ שנשמר על כל משימה."
        actions={
          <ButtonLink href={`/print/revenue/${periodKey(period)}`} variant="secondary" target="_blank">
            <PrintIcon className="size-4.5" />
            הדפסה
          </ButtonLink>
        }
      />

      {/* Stepping through time follows the reading direction: the previous month sits at the start
          (right in Hebrew) with its chevron pointing back, the next month at the end — the same as
          CursorPagination and Hebrew calendars (Koma's month stepper, used in production). */}
      <div className="mb-5 flex items-center justify-between gap-3 border-b-2 border-accent pb-3">
        <Link href={`/reports/revenue?period=${periodKey(previous)}`} className="flex min-h-11 items-center gap-1 text-body text-ink-muted hover:text-ink" aria-label={`לחודש הקודם: ${formatPeriod(previous)}`}>
          <ChevronBackIcon className="size-5" />
        </Link>
        <div className="flex flex-col items-center">
          <h2 className="text-section font-bold text-ink">{formatPeriod(period)}</h2>
          <StatusBadge label={report.state.isClosed ? 'חודש סגור' : 'חודש פתוח'} tone={report.state.isClosed ? 'success' : 'neutral'} />
        </div>
        {canGoForward ? (
          <Link href={`/reports/revenue?period=${periodKey(next)}`} className="flex min-h-11 items-center gap-1 text-body text-ink-muted hover:text-ink" aria-label={`לחודש הבא: ${formatPeriod(next)}`}>
            <ChevronForwardIcon className="size-5" />
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {report.state.isClosed && (
        <p className="mb-5 rounded-surface bg-success-tint px-4 py-3 text-body text-ink">
          החודש נסגר{report.state.closedByName ? ` על ידי ${report.state.closedByName}` : ''}
          {report.state.closedAt && (
            <>
              {' ב־'}
              <DateTimeText value={report.state.closedAt} />
            </>
          )}
          . הנתונים נקראים מתמונת המצב שנשמרה בסגירה ואינם מחושבים מחדש.
        </p>
      )}
      {!report.state.isClosed && report.state.reopenReason && (
        <p className="mb-5 rounded-surface bg-warning-tint px-4 py-3 text-body text-ink">
          החודש נפתח מחדש על ידי {report.state.reopenedByName}: “{report.state.reopenReason}”
        </p>
      )}

      <Section>
        {report.lines.length === 0 ? (
          <EmptyState title="אין משימות שבוצעו בחודש הזה" description="הדוח מחושב ממשימות שתאריך הביצוע שלהן בתוך החודש. אם עבודה בוצעה ולא מופיעה, כדאי לבדוק שהמשימה סומנה כבוצעה ושתאריך הביצוע נכון." />
        ) : (
          <div className="surface scroll-x">
            <table className="w-full min-w-[36rem] border-collapse text-body">
              <caption className="sr-only">הכנסות לפי מבצע, {formatPeriod(period)}</caption>
              <thead>
                <tr className="rule-b-strong bg-sunken text-micro font-semibold text-ink-subtle">
                  <th scope="col" className="px-4 py-2.5 text-start">מבצע</th>
                  <th scope="col" className="px-4 py-2.5 text-end">משימות</th>
                  <th scope="col" className="px-4 py-2.5 text-end">לפני מע״מ</th>
                  <th scope="col" className="px-4 py-2.5 text-end">מע״מ</th>
                  <th scope="col" className="px-4 py-2.5 text-end">סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.assigneeId ?? 'none'} className="rule-b">
                    <th scope="row" className="px-4 py-3 text-start font-medium text-ink">{line.assigneeName}</th>
                    <td className="tnum px-4 py-3 text-end">
                      {line.taskCount}
                      {line.unpricedCount > 0 && <span className="block text-meta text-warning-text">מתוכן {line.unpricedCount} ללא מחיר</span>}
                    </td>
                    <td className="px-4 py-3 text-end"><MoneyText value={line.net} /></td>
                    <td className="px-4 py-3 text-end"><MoneyText value={line.vat} /></td>
                    <td className="px-4 py-3 text-end font-medium"><MoneyText value={line.gross} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-[3px] border-double border-ink font-semibold">
                  <th scope="row" className="px-4 py-3 text-start">סה״כ</th>
                  <td className="tnum px-4 py-3 text-end">{report.totals.taskCount}</td>
                  <td className="px-4 py-3 text-end"><MoneyText value={report.totals.net} /></td>
                  <td className="px-4 py-3 text-end"><MoneyText value={report.totals.vat} /></td>
                  <td className="px-4 py-3 text-end"><MoneyText value={report.totals.gross} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      {can(actor, 'periods.close') && (
        <Section title="סגירת החודש" description="סגירה שומרת את התוצאה כתמונת מצב ונועלת שינויים שמשפיעים על הכנסות החודש.">
          <PeriodControls periodKey={periodKey(period)} periodLabel={formatPeriod(period)} isClosed={report.state.isClosed} unpricedCount={report.totals.unpricedCount} />
        </Section>
      )}
    </>
  );
}
