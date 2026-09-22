import type { ReactNode } from 'react';
import { brand } from '@/brand/brand';
import { formatDateTime } from '@/core/dates/instant';
import { PrintButton } from './PrintButton';

/**
 * A printable business document.
 *
 * On screen it previews as a sheet of paper with a print button; on paper the
 * app chrome disappears and what remains is a document: business identity,
 * document title, the metadata that makes it a record (period, who produced
 * it, when), the content, and a footer line.
 *
 * Decide deliberately what belongs on paper. A screen shows controls, filters
 * and hints; a document shows facts and totals.
 */
export function PrintLayout({
  title,
  subtitle,
  meta,
  children,
  producedBy,
}: {
  title: string;
  subtitle?: string;
  /** Label/value pairs printed under the title, e.g. period, status. */
  meta?: Array<{ label: string; value: ReactNode }>;
  children: ReactNode;
  producedBy?: string;
}) {
  const producedAt = formatDateTime(new Date());
  // Unset identity fields (empty strings) are left out rather than printed as blanks.
  const contactLine = [brand.address, brand.phone && <bdi dir="ltr">{brand.phone}</bdi>, brand.businessId && <bdi dir="ltr">{brand.businessId}</bdi>].filter(Boolean);
  return (
    <div className="min-h-dvh bg-canvas py-6 print:bg-white print:py-0">
      <div className="print-hide mx-auto mb-4 flex max-w-[210mm] justify-end px-4">
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[12mm] py-[14mm] text-[10.5pt] leading-normal text-black shadow-[var(--shadow-raised)] print:max-w-none print:p-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div>
            <p className="text-[13pt] font-bold">{brand.legalName}</p>
            {contactLine.length > 0 && (
              <p className="text-[9pt] text-[#444]">
                {contactLine.map((part, index) => (
                  <span key={index}>
                    {index > 0 && ' · '}
                    {part}
                  </span>
                ))}
              </p>
            )}
          </div>
          <div className="text-end">
            <h1 className="text-[16pt] font-bold">{title}</h1>
            {subtitle && <p className="text-[10pt]">{subtitle}</p>}
          </div>
        </header>

        {meta && meta.length > 0 && (
          <dl className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1 text-[9.5pt] sm:grid-cols-3">
            {meta.map((item) => (
              <div key={item.label} className="flex gap-2">
                <dt className="text-[#555]">{item.label}:</dt>
                <dd className="font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div>{children}</div>

        <footer className="mt-8 border-t border-[#999] pt-2 text-[8.5pt] text-[#555]">
          הופק ב־<bdi dir="ltr">{producedAt}</bdi>
          {producedBy ? ` על ידי ${producedBy}` : ''} · {brand.appName}
        </footer>
      </article>
    </div>
  );
}

/** Table styles for documents: ruled, black on white, no colour dependence. */
export const printTable = {
  table: 'w-full border-collapse text-[9.5pt]',
  th: 'border-b border-black py-1.5 text-start font-semibold',
  thNumeric: 'border-b border-black py-1.5 text-end font-semibold',
  td: 'border-b border-[#ccc] py-1.5 align-top',
  tdNumeric: 'border-b border-[#ccc] py-1.5 text-end align-top tnum',
  totalRow: 'border-t-[3px] border-double border-black font-bold',
};
