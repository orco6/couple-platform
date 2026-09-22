import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/core/ui/cx';
import { ChevronDownIcon } from '@/core/ui/components/Icons';
import { nextSort, type SortDirection, type SortState } from '@/core/ui/sorting';

/**
 * ResponsiveTable: a real <table> from 768px, a list of rows below it.
 *
 * On a phone a wide table either scrolls sideways (people miss columns) or
 * crushes text. Instead each row becomes a block: the `primary` column is the
 * row title, `secondary` columns form one line under it, `end` columns sit at
 * the inline end (amounts, status), and `hidden` columns are left out.
 *
 * Numeric columns align to the inline END and use tabular figures, so amounts
 * line up by their last digit in RTL and LTR alike.
 *
 * Missing values: a cell returns `null` (not '—'). The table shows a quiet dash;
 * the phone row simply leaves the value out, so a customer with no phone and no
 * city reads "שירה גל", not "— · — · שירה גל" (found in the screenshot sweep).
 * The primary text wraps to two lines before truncating: a long business name
 * usually differs from its neighbours at the END.
 *
 * Rendered on the server. Both layouts are in the DOM; CSS shows one (the
 * hidden one is display:none, so assistive technology reads only one).
 *
 * Sorting (optional) is URL state handled by the server query — see
 * core/ui/sorting.ts. Sortable headers are links with aria-sort; on phones the
 * page offers a sort control instead (headers are not shown). The header row
 * sticks to the top of the viewport while a long table scrolls.
 */

export interface Column<Row> {
  key: string;
  header: string;
  /** Return null for a missing value. */
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
  /** Placement in the mobile row. Default 'secondary'. */
  mobile?: 'primary' | 'secondary' | 'end' | 'hidden';
  className?: string;
  /** Header becomes a sort link. The column key is the sort key. */
  sortable?: boolean;
  /** Direction of the first click (dates and amounts usually start 'desc'). */
  sortFirst?: SortDirection;
}

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === false || value === '';
}

function orDash(value: ReactNode): ReactNode {
  return isEmpty(value) ? <span className="text-ink-subtle">—</span> : value;
}

export function ResponsiveTable<Row>({
  columns,
  rows,
  rowKey,
  rowHref,
  caption,
  footer,
  sort,
}: {
  columns: readonly Column<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  /** Makes the primary cell a link (the whole mobile row is the link target). */
  rowHref?: (row: Row) => string;
  /** Required for screen readers; visually hidden. */
  caption: string;
  footer?: ReactNode;
  sort?: { state: SortState; href: (state: SortState) => string };
}) {
  const primary = columns.find((column) => column.mobile === 'primary') ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && (column.mobile ?? 'secondary') === 'secondary');
  const end = columns.filter((column) => column !== primary && column.mobile === 'end');

  return (
    <div className="surface overflow-clip">
      <table className="hidden w-full border-collapse text-body md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="rule-b-strong">
            {columns.map((column) => {
              const active = sort && column.sortable && sort.state.key === column.key;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? (sort.state.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cx(
                    'sticky top-0 z-10 bg-sunken px-4 py-2.5 text-micro font-semibold text-ink-subtle',
                    column.numeric ? 'text-end' : 'text-start',
                    column.className,
                  )}
                >
                  {sort && column.sortable ? (
                    <Link
                      href={sort.href(nextSort(sort.state, column.key, column.sortFirst))}
                      className={cx('inline-flex items-center gap-1 rounded-sm hover:text-ink', active && 'text-ink')}
                    >
                      {column.header}
                      <ChevronDownIcon
                        aria-hidden="true"
                        className={cx('size-3.5 transition-transform', !active && 'opacity-0', active && sort.state.dir === 'asc' && 'rotate-180')}
                      />
                    </Link>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="rule-b transition-colors duration-[var(--motion-feedback)] last:border-b-0 hover:bg-hover">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    'row-y px-4 align-middle text-ink',
                    column.numeric && 'tnum text-end',
                    column === primary && 'font-medium',
                    column.className,
                  )}
                >
                  {column === primary && rowHref ? (
                    <Link href={rowHref(row)} className="hover:text-accent-text hover:underline underline-offset-2">
                      {orDash(column.cell(row))}
                    </Link>
                  ) : (
                    orDash(column.cell(row))
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>

      <ul className="divide-y divide-rule-faint md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const content = (
            <div className="row-y flex items-start gap-3 px-4">
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 break-words text-row font-medium text-ink">{primary?.cell(row)}</div>
                {(() => {
                  const present = secondary.map((column) => ({ column, value: column.cell(row) })).filter(({ value }) => !isEmpty(value));
                  return present.length > 0 ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-ink-muted">
                      {present.map(({ column, value }, index) => (
                        <span key={column.key} className="inline-flex min-w-0 items-center gap-2">
                          {index > 0 && <span aria-hidden="true" className="text-rule-strong">·</span>}
                          <span className="sr-only">{column.header}: </span>
                          {value}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              {end.length > 0 && (
                <div className="flex shrink-0 flex-col items-end gap-1 text-end">
                  {end.map((column) => {
                    const value = column.cell(row);
                    return isEmpty(value) ? null : (
                      <span key={column.key} className={cx(column.numeric && 'tnum', 'text-body')}>
                        <span className="sr-only">{column.header}: </span>
                        {value}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link href={rowHref(row)} className="block active:bg-hover">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
