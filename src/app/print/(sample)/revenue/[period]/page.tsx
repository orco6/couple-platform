import { notFound } from 'next/navigation';
import { requirePermissionPage } from '@/core/auth/page-guards';
import { formatPeriod, parsePeriodKey } from '@/core/dates/period';
import { formatDateTime } from '@/core/dates/instant';
import { db } from '@/core/db/client';
import { formatMoney } from '@/core/money/format';
import { PrintLayout, printTable } from '@/core/ui/print/PrintLayout';
import { getRevenueReport } from '@/domain/sample/revenue';

export const metadata = { title: 'דוח הכנסות להדפסה' };

/**
 * A document, not a screenshot: only the facts a bookkeeper files — period,
 * status, per-person figures and totals. No filters, no badges, no buttons.
 */
export default async function PrintRevenuePage({ params }: { params: Promise<{ period: string }> }) {
  const actor = await requirePermissionPage('reports.revenue');
  const period = parsePeriodKey((await params).period);
  if (!period) notFound();
  const report = await getRevenueReport(db, actor, period);

  return (
    <PrintLayout
      title="דוח הכנסות חודשי"
      subtitle={formatPeriod(period)}
      producedBy={actor.name}
      meta={[
        { label: 'תקופה', value: formatPeriod(period) },
        {
          label: 'מצב',
          value: report.state.isClosed ? `סגור${report.state.closedAt ? ` (${formatDateTime(report.state.closedAt)})` : ''}` : 'פתוח — נתונים עשויים להשתנות',
        },
        { label: 'גרסת חישוב', value: report.calculationVersion },
      ]}
    >
      {report.lines.length === 0 ? (
        <p>אין משימות שבוצעו בתקופה.</p>
      ) : (
        <table className={printTable.table}>
          <thead>
            <tr>
              <th className={printTable.th}>מבצע</th>
              <th className={printTable.thNumeric}>משימות</th>
              <th className={printTable.thNumeric}>לפני מע״מ</th>
              <th className={printTable.thNumeric}>מע״מ</th>
              <th className={printTable.thNumeric}>סה״כ</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.assigneeId ?? 'none'}>
                <td className={printTable.td}>{line.assigneeName}</td>
                <td className={printTable.tdNumeric}>{line.taskCount}{line.unpricedCount > 0 ? ` (${line.unpricedCount} ללא מחיר)` : ''}</td>
                <td className={printTable.tdNumeric}><bdi dir="ltr">{formatMoney(line.net, { decimals: 'always' })}</bdi></td>
                <td className={printTable.tdNumeric}><bdi dir="ltr">{formatMoney(line.vat, { decimals: 'always' })}</bdi></td>
                <td className={printTable.tdNumeric}><bdi dir="ltr">{formatMoney(line.gross, { decimals: 'always' })}</bdi></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={printTable.totalRow}>
              <td className="py-2">סה״כ</td>
              <td className="tnum py-2 text-end">{report.totals.taskCount}</td>
              <td className="tnum py-2 text-end"><bdi dir="ltr">{formatMoney(report.totals.net, { decimals: 'always' })}</bdi></td>
              <td className="tnum py-2 text-end"><bdi dir="ltr">{formatMoney(report.totals.vat, { decimals: 'always' })}</bdi></td>
              <td className="tnum py-2 text-end"><bdi dir="ltr">{formatMoney(report.totals.gross, { decimals: 'always' })}</bdi></td>
            </tr>
          </tfoot>
        </table>
      )}
    </PrintLayout>
  );
}
