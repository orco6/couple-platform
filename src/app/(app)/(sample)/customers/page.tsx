import { can } from '@/core/access/can';
import { requireActorPage } from '@/core/auth/page-guards';
import { db } from '@/core/db/client';
import { ResponsiveTable } from '@/core/ui/components/DataTable';
import { ClearFilters, hasActiveFilters } from '@/core/ui/components/ClearFilters';
import { FilterBar, SearchFilter, SelectFilter, SortFilter } from '@/core/ui/components/FilterBar';
import { PageHeader, Toolbar } from '@/core/ui/components/Layout';
import { CursorPagination } from '@/core/ui/components/Navigation';
import { EmptyState } from '@/core/ui/components/States';
import { DateText, Ltr } from '@/core/ui/components/Text';
import { calendarDateOfInstant } from '@/core/dates/calendar-date';
import { parseSort, sortSearchParams } from '@/core/ui/sorting';
import { CUSTOMER_DEFAULT_SORT, CUSTOMER_SORT_KEYS, customerListQuerySchema, listAssignableUsers, listCustomers } from '@/domain/sample/customers';
import { NewCustomerButton } from './CustomerFormDialog';

export const metadata = { title: 'לקוחות' };

const CUSTOMER_FILTERS = ['q', 'owner'] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActorPage();
  const raw = await searchParams;
  const sort = parseSort(raw, CUSTOMER_SORT_KEYS, CUSTOMER_DEFAULT_SORT);
  const query = customerListQuerySchema.safeParse({ q: raw.q, owner: raw.owner, cursor: raw.cursor, sort: sort.key, dir: sort.dir });
  const filters = query.success ? query.data : { sort: sort.key, dir: sort.dir };
  const seesAll = can(actor, 'customers.read_all');

  const [{ customers, nextCursor }, owners] = await Promise.all([
    listCustomers(db, actor, filters),
    can(actor, 'customers.edit_all') ? listAssignableUsers(db) : Promise.resolve(undefined),
  ]);

  const filterParams = { q: filters.q, owner: filters.owner };
  const baseParams = sortSearchParams(filterParams, sort);

  return (
    <>
      <PageHeader
        title="לקוחות"
        description={seesAll ? 'כל הלקוחות הפעילים של העסק.' : 'הלקוחות שבאחריותך.'}
        actions={can(actor, 'customers.create') ? <NewCustomerButton owners={owners} /> : undefined}
      />
      <Toolbar
        start={
          <FilterBar>
            <SearchFilter placeholder="חיפוש לפי שם, טלפון או עיר" />
            {seesAll && (
              <SelectFilter name="owner" label="אחראי" allLabel="כל האחראים" options={[{ value: 'mine', label: 'באחריותי' }]} />
            )}
            <SortFilter
              label="מיון"
              options={[
                { key: 'name', dir: 'asc', label: 'לפי שם (א-ת)' },
                { key: 'name', dir: 'desc', label: 'לפי שם (ת-א)' },
                { key: 'createdAt', dir: 'desc', label: 'החדשים קודם' },
                { key: 'city', dir: 'asc', label: 'לפי עיר' },
              ]}
            />
            <ClearFilters pathname="/customers" params={raw} filters={CUSTOMER_FILTERS} />
          </FilterBar>
        }
      />
      {customers.length === 0 ? (
        <EmptyState
          title={hasActiveFilters(raw, CUSTOMER_FILTERS) ? 'לא נמצאו לקוחות שמתאימים לסינון' : 'עדיין אין לקוחות'}
          description={
            hasActiveFilters(raw, CUSTOMER_FILTERS)
              ? 'כדאי לבדוק את האיות, לחפש לפי טלפון או עיר, או לנקות את הסינון.'
              : 'לקוח שנוסף מופיע כאן עם הטלפון, העיר והאחראי עליו.'
          }
          action={<ClearFilters pathname="/customers" params={raw} filters={CUSTOMER_FILTERS} label="ניקוי הסינון והצגת כל הלקוחות" />}
        />
      ) : (
        <ResponsiveTable
          caption="רשימת לקוחות"
          rows={customers}
          rowKey={(customer) => customer.id}
          rowHref={(customer) => `/customers/${customer.id}`}
          sort={{ state: sort, href: (next) => `/customers?${sortSearchParams(filterParams, next)}` }}
          columns={[
            { key: 'name', header: 'שם', cell: (c) => c.name, mobile: 'primary', sortable: true },
            { key: 'phone', header: 'טלפון', cell: (c) => (c.phone ? <Ltr className="tnum">{c.phone}</Ltr> : null) },
            { key: 'city', header: 'עיר', cell: (c) => c.city, sortable: true },
            { key: 'createdAt', header: 'נוסף', cell: (c) => <DateText value={calendarDateOfInstant(new Date(c.createdAt))} />, sortable: true, sortFirst: 'desc', mobile: 'hidden' },
            ...(seesAll ? [{ key: 'owner', header: 'אחראי', cell: (c: (typeof customers)[number]) => c.owner.name }] : []),
          ]}
        />
      )}
      <CursorPagination
        firstHref={filters.cursor ? `/customers?${baseParams}` : null}
        nextHref={nextCursor ? `/customers?${new URLSearchParams([...baseParams, ['cursor', nextCursor]])}` : null}
      />
    </>
  );
}
