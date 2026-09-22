'use client';

import { useRef, useState } from 'react';
import { Logo } from '@/brand/Logo';
import type { CalendarDate } from '@/core/dates/calendar-date';
import type { LocalTime } from '@/core/dates/local-time';
import type { Minor } from '@/core/money/money';
import { Button, IconButton } from '@/core/ui/components/Button';
import { ButtonLink } from '@/core/ui/components/ButtonLink';
import { Checkbox, RadioGroup, Switch } from '@/core/ui/components/Choice';
import { ResponsiveTable } from '@/core/ui/components/DataTable';
import { DateInput } from '@/core/ui/components/DateInput';
import { BottomSheet, ConfirmDialog, Dialog } from '@/core/ui/components/Dialog';
import { Disclosure } from '@/core/ui/components/Disclosure';
import { FormField, Input, Select, Textarea } from '@/core/ui/components/Field';
import { CloseIcon, PlusIcon, PrintIcon } from '@/core/ui/components/Icons';
import { DescriptionList, FormError, FormSection, Notice, PageHeader, Panel, Section } from '@/core/ui/components/Layout';
import { MoneyInput } from '@/core/ui/components/MoneyInput';
import { PasswordField } from '@/core/ui/components/PasswordField';
import { EmptyState, ErrorState, LoadingState } from '@/core/ui/components/States';
import { StatusBadge, type StatusTone } from '@/core/ui/components/StatusBadge';
import { DateText, DateTimeText, EmailLink, Ltr, MoneyText, PhoneLink } from '@/core/ui/components/Text';
import { TimeInput } from '@/core/ui/components/TimeInput';
import { useToast } from '@/core/ui/components/Toast';
import { copy } from '@/core/copy';
import type { SortState } from '@/core/ui/sorting';

/**
 * The component gallery (development and preview only; 404 in production).
 *
 * Every primitive in the states a screen will put it in, with REALISTIC Hebrew
 * content: long names and addresses, phone numbers, agorot amounts, dates,
 * overdue rows, empty fields. Designs that only survive "Test User / Task 1"
 * do not survive a real business. Used by design review, the screenshot sweep
 * (npm run qa:screenshots) and the component E2E tests — keep the test ids.
 */

interface Row {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  dueOn: CalendarDate | null;
  amount: Minor | null;
  status: { label: string; tone: StatusTone };
  overdue?: boolean;
}

const ROWS: Row[] = [
  { id: '1', name: 'מרכז רפואי שערי צדק — מחלקת רכש וציוד רפואי', city: 'ירושלים', phone: '02-6555111', dueOn: '2026-09-02' as CalendarDate, amount: 1_284_050, status: { label: 'באיחור', tone: 'warning' }, overdue: true },
  { id: '2', name: 'אבו-ג׳אבר עבודות חשמל ואינסטלציה בע״מ', city: 'כפר קאסם', phone: '054-7788123', dueOn: '2026-09-21' as CalendarDate, amount: 45_900, status: { label: 'פתוחה', tone: 'neutral' } },
  { id: '3', name: 'Anna Petrova', city: 'בת ים', phone: null, dueOn: null, amount: null, status: { label: 'פתוחה', tone: 'neutral' } },
  { id: '4', name: 'יוסף בן-חיים ובניו — שיפוצים', city: 'קריית שמונה', phone: '050-1234567', dueOn: '2026-09-15' as CalendarDate, amount: 330_000, status: { label: 'בביצוע', tone: 'active' } },
  { id: '5', name: 'דנה לוי', city: 'תל אביב-יפו', phone: '052-9876543', dueOn: '2026-08-30' as CalendarDate, amount: 118_050, status: { label: 'בוצעה', tone: 'success' } },
  { id: '6', name: 'עמותת ״יד ביד״ לקידום חינוך משותף', city: null, phone: '03-5100200', dueOn: '2026-08-12' as CalendarDate, amount: 7_500, status: { label: 'בוטלה', tone: 'muted' } },
];

function sortRows(rows: Row[], sort: SortState<'name' | 'dueOn' | 'amount'>): Row[] {
  const direction = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    if (left === null) return 1;
    if (right === null) return -1;
    return (left < right ? -1 : left > right ? 1 : 0) * direction;
  });
}

export function Gallery({ sort }: { sort: SortState<'name' | 'dueOn' | 'amount'> }) {
  const toast = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [longDialogOpen, setLongDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(0);
  const openAfterSheet = useRef<null | (() => void)>(null);
  const [date, setDate] = useState<CalendarDate | ''>('');
  const [time, setTime] = useState<LocalTime | ''>('');
  const [amountSigned, setAmountSigned] = useState<Minor | null>(null);
  const [dateInvalid, setDateInvalid] = useState(false);
  const [amount, setAmount] = useState<Minor | null>(null);
  const [password, setPassword] = useState('');
  const [choice, setChoice] = useState<string | null>('a');
  const [switchOn, setSwitchOn] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = sortRows(ROWS, sort);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader eyebrow={<Logo />} title="רכיבים" description="כל רכיבי הבסיס במצביהם, עם תוכן אמיתי באורכים אמיתיים. לבדיקת עיצוב ולבדיקות אוטומטיות בלבד." />

      <nav aria-label="חלקי הגלריה" className="mb-8 flex flex-wrap gap-x-4 gap-y-1 text-body">
        {[
          ['buttons', 'כפתורים'],
          ['forms', 'טפסים'],
          ['field-states', 'מצבי שדה'],
          ['tables', 'טבלה ורשימה'],
          ['statuses', 'סטטוסים'],
          ['states', 'ריק, שגיאה, טעינה'],
          ['record-states', 'מצבי רשומה ושגיאות'],
          ['overlays', 'שכבות'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-accent-text underline-offset-2 hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <div id="buttons" className="scroll-mt-20">
        <Section title="כפתורים" description="פעולה ראשית אחת במסך. לחיצה נרשמת תוך 40ms; מצב טעינה לא משנה את רוחב הכפתור.">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">פעולה ראשית</Button>
            <Button variant="secondary">פעולה משנית</Button>
            <Button variant="quiet">שקט</Button>
            <Button variant="danger">מחיקה</Button>
            <Button variant="primary" loading>
              שומר
            </Button>
            <Button variant="secondary" disabled>
              לא זמין
            </Button>
            <Button variant="secondary" size="sm">
              קטן
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              loading={saving}
              data-testid="gallery-loading-button"
              onClick={() => {
                setSaving(true);
                window.setTimeout(() => setSaving(false), 1200);
              }}
            >
              <PlusIcon className="size-4.5" />
              הוספת משימה ללקוח
            </Button>
            <ButtonLink href="#tables" variant="secondary">
              <PrintIcon className="size-4.5" />
              סיכום להדפסה
            </ButtonLink>
            <IconButton label="סגירת ההודעה">
              <CloseIcon />
            </IconButton>
          </div>
          <div className="mt-4 max-w-[20rem] rounded-surface border border-rule-faint p-3" data-testid="gallery-narrow-actions">
            <p className="mb-2 text-meta text-ink-subtle">מסך צר (320px): פעולות בשורה, תוויות ארוכות</p>
            <div className="flex gap-2.5">
              <Button variant="secondary" className="flex-1">
                ביטול
              </Button>
              <Button variant="danger" className="flex-1">
                העברה לארכיון
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <div id="forms" className="scroll-mt-20">
        <Section title="טפסים">
          <Panel>
            <FormSection title="פרטי לקוח" description="שדות בכיוון שמאל-לימין (טלפון, דוא״ל) נשארים שלמים בתוך טופס עברי.">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="טקסט" required>
                  {(props) => <Input {...props} placeholder="שם הלקוח" />}
                </FormField>
                <FormField label="טקסט עם שגיאה" error="שם הלקוח הוא שדה חובה">
                  {(props) => <Input {...props} />}
                </FormField>
                <FormField label="טלפון" hint="שדה בכיוון שמאל-לימין בתוך טופס עברי">
                  {(props) => <Input {...props} dir="ltr" className="text-start" type="tel" defaultValue="050-1234567" />}
                </FormField>
                <FormField label="בחירה">
                  {(props) => (
                    <Select {...props} defaultValue="b">
                      <option value="a">אפשרות א</option>
                      <option value="b">אפשרות ב</option>
                    </Select>
                  )}
                </FormField>
              </div>
            </FormSection>
            <FormSection title="תאריכים, שעות וסכומים">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="תאריך" error={dateInvalid ? 'תאריך לא תקין. יש לכתוב בתבנית DD.MM.YYYY' : undefined}>
                  {(props) => <DateInput {...props} value={date} onChange={setDate} onInvalidChange={setDateInvalid} data-testid="gallery-date" />}
                </FormField>
                <FormField label="שעה">
                  {(props) => <TimeInput {...props} value={time} onChange={setTime} data-testid="gallery-time" />}
                </FormField>
                <FormField label="החזר (סכום שלילי מותר)">
                  {(props) => <MoneyInput {...props} allowNegative value={amountSigned} onChange={setAmountSigned} data-testid="gallery-money-signed" />}
                </FormField>
                <FormField label="סכום">
                  {(props) => <MoneyInput {...props} value={amount} onChange={setAmount} data-testid="gallery-money" />}
                </FormField>
                <PasswordField label="סיסמה" autoComplete="new-password" value={password} onChange={setPassword} required={false} />
                <FormField label="טקסט ארוך">
                  {(props) => <Textarea {...props} rows={3} />}
                </FormField>
              </div>
              <p className="mt-3 text-meta text-ink-subtle">
                ערך תאריך: <span data-testid="gallery-date-value">{date || 'ריק'}</span> · ערך סכום:{' '}
                <span data-testid="gallery-money-value">{amount ?? 'ריק'}</span> · ערך שעה: <span data-testid="gallery-time-value">{time || 'ריק'}</span> · החזר:{' '}
                <span data-testid="gallery-money-signed-value">{amountSigned ?? 'ריק'}</span>
              </p>
            </FormSection>
            <FormSection title="בחירות">
              <div className="grid gap-2 sm:grid-cols-2">
                <RadioGroup
                  legend="בחירה אחת"
                  name="gallery-choice"
                  value={choice}
                  onChange={setChoice}
                  layout="segmented"
                  options={[
                    { value: 'a', label: 'חדשה' },
                    { value: 'b', label: 'חידוש' },
                  ]}
                />
                <div>
                  <Checkbox label="לשלוח עותק" description="עותק יישלח לדוא״ל הלקוח" />
                  <Switch label="התראות" checked={switchOn} onChange={setSwitchOn} />
                </div>
              </div>
            </FormSection>
            <div className="mt-4">
              <FormError message="לא ניתן לשמור: הנתונים שונו בינתיים על ידי מישהו אחר. יש לרענן את הדף ולנסות שוב." />
            </div>
          </Panel>
        </Section>
      </div>

      <div id="field-states" className="scroll-mt-20">
        <Section title="מצבי שדה" description="אותו שדה בכל מצב. הגבול נשאר ברוחב אחד — המצב משנה צבע וטבעת, לא את הגיאומטריה.">
          <Panel>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="ברירת מחדל">{(props) => <Input {...props} defaultValue="רחוב הרצל 12, דירה 4" />}</FormField>
              <FormField label="עם הסבר" hint="כפי שמופיע בחשבונית">{(props) => <Input {...props} />}</FormField>
              <FormField label="חובה" required>{(props) => <Input {...props} />}</FormField>
              <FormField label="שגיאה" error="מספר טלפון לא תקין">
                {(props) => <Input {...props} dir="ltr" className="text-start" defaultValue="050-12" />}
              </FormField>
              <FormField label="מושבת" hint="נקבע על ידי מנהל">{(props) => <Input {...props} disabled defaultValue="ישראל ישראלי" />}</FormField>
              <FormField label="לקריאה בלבד" hint="החודש סגור">
                {(props) => <Input {...props} readOnly defaultValue="₪1,180.50" dir="ltr" className="text-start" />}
              </FormField>
            </div>
          </Panel>
        </Section>
      </div>

      <div id="tables" className="scroll-mt-20">
        <Section title="טבלה ורשימה" description="טבלה אמיתית מ-768px, שורות ברשימה בטלפון. מיון בשרת דרך הכתובת; שורה באיחור מקבלת טקסט, לא רק צבע.">
          <ResponsiveTable
            caption="לקוחות לדוגמה"
            rows={rows}
            rowKey={(row) => row.id}
            rowHref={() => '#tables'}
            sort={{ state: sort, href: (next) => `/design-system?sort=${next.key}&dir=${next.dir}#tables` }}
            columns={[
              { key: 'name', header: 'שם', cell: (row) => row.name, mobile: 'primary', sortable: true },
              { key: 'city', header: 'עיר', cell: (row) => row.city },
              { key: 'phone', header: 'טלפון', cell: (row) => (row.phone ? <Ltr className="tnum">{row.phone}</Ltr> : null) },
              {
                key: 'dueOn',
                header: 'תאריך יעד',
                sortable: true,
                sortFirst: 'asc',
                cell: (row) => (
                  row.dueOn && (
                    <span className={row.overdue ? 'font-medium text-warning-text' : undefined}>
                      <DateText value={row.dueOn} />
                      {row.overdue && ' · באיחור'}
                    </span>
                  )
                ),
              },
              { key: 'amount', header: 'סכום', numeric: true, sortable: true, sortFirst: 'desc', cell: (row) => (row.amount === null ? null : <MoneyText value={row.amount} />), mobile: 'end' },
              { key: 'status', header: 'סטטוס', cell: (row) => <StatusBadge label={row.status.label} tone={row.status.tone} />, mobile: 'end' },
            ]}
          />
          <p className="mt-6 mb-2 text-label font-semibold text-ink-muted">רשימה (שורה עם פרטים ופעולה בקצה)</p>
          <ul className="surface divide-y divide-rule-faint">
            {ROWS.slice(0, 3).map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-row font-medium text-ink">{row.name}</p>
                  <p className="mt-0.5 text-label text-ink-muted">
                    {row.city ?? 'ללא עיר'} · <PhoneLink value={row.phone} />
                  </p>
                </div>
                <MoneyText value={row.amount} className="shrink-0 text-body" />
              </li>
            ))}
          </ul>
          <DescriptionList
            columns={3}
            items={[
              { label: 'סכום', value: <MoneyText value={118050} /> },
              { label: 'דוא״ל', value: <Ltr>accounts.payable@shaarei-tzedek-medical.org.il</Ltr> },
              { label: 'כתובת', value: 'שדרות שמואל בית 12, קומה 3, ירושלים' },
            ]}
          />
          <Disclosure summary="פרטים נוספים" className="mt-4 border-t border-rule-faint">
            <p className="text-body text-ink-muted">תוכן שנפתח ונסגר, עם אנימציית גובה ונגישות מלאה.</p>
          </Disclosure>
        </Section>
      </div>

      <div id="statuses" className="scroll-mt-20">
        <Section title="סטטוסים" description="מצבים רגילים שקטים (טקסט), מצבים שזזו או דורשים תשומת לב — שבב.">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label="פתוחה" />
            <StatusBadge label="בוטלה" tone="muted" />
            <StatusBadge label="בביצוע" tone="active" />
            <StatusBadge label="בוצעה" tone="success" />
            <StatusBadge label="ממתין לחשבונית" tone="warning" />
            <StatusBadge label="נדחה" tone="danger" />
          </div>
        </Section>
      </div>

      <div id="states" className="scroll-mt-20">
        <Section title="ריק, שגיאה, טעינה">
          <div className="grid gap-4">
            <div className="surface">
              <EmptyState
                title="עדיין אין לקוחות"
                description="לקוח שנוסף מופיע כאן עם הטלפון והמשימות הפתוחות שלו. אפשר להתחיל מהלקוח שמתקשר הכי הרבה."
                action={<Button variant="primary">לקוח חדש</Button>}
              />
            </div>
            <ErrorState title="הרשימה לא נטענה" description="ייתכן שאין חיבור לשרת. הנתונים שכבר נשמרו לא נפגעו." action={<Button>לנסות שוב</Button>} />
            <LoadingState rows={3} />
          </div>
        </Section>
      </div>

      <div id="record-states" className="scroll-mt-20">
        <Section
          title="מצבי רשומה ושגיאות"
          description="מה שאדם רואה כשפעולה לא זמינה או נכשלה: הסיבה נשארת על המסך, לא בהודעה שנעלמת. השרת תמיד מחליט; המסך רק לא מבטיח מה שהשרת יסרב לו."
        >
          <div className="grid gap-4">
            <Panel>
              <p className="mb-1 text-label font-semibold text-ink-muted">רשומה בארכיון (לקריאה בלבד)</p>
              <h3 className="heading-section text-section text-balance text-ink">מרכז רפואי שערי צדק — מחלקת רכש, ציוד רפואי ותחזוקת מבנים</h3>
              <Notice className="mt-3" >
                בארכיון מאז 12.08.2026 · הועבר על ידי דנה לוי-אברהמי · סיבה: החוזה הסתיים והלקוח עבר לספק אחר. אפשר לשחזר עם סיבה; ההיסטוריה נשמרה.
              </Notice>
              <div className="mt-4">
                <DescriptionList
                  columns={3}
                  items={[
                    { label: 'טלפון', value: <PhoneLink value="02-6555111" /> },
                    { label: 'דוא״ל', value: <EmailLink value="accounts.payable@shaarei-tzedek-medical.org.il" /> },
                    { label: 'יתרה פתוחה', value: <MoneyText value={-1_284_050} /> },
                    { label: 'עודכן לאחרונה', value: <DateTimeText value="2026-08-12T15:42:00.000Z" /> },
                    { label: 'כתובת', value: 'שדרות שמואל בית 12, קומה 3, חדר 318, ירושלים' },
                    { label: 'איש קשר', value: null },
                  ].map((item) => ({ ...item, value: item.value ?? <span className="text-ink-subtle">—</span> }))}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary">שחזור מהארכיון</Button>
              </div>
            </Panel>
            <Panel>
              <p className="mb-2 text-label font-semibold text-ink-muted">תקופה סגורה: פעולות שהשרת יסרב להן לא מוצגות, והסיבה כתובה</p>
              <Notice>08/2026 סגור: הסטטוס, המחיר והאחראי נעולים עד שהחודש ייפתח מחדש.</Notice>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <FormField label="מחיר לפני מע״מ" hint="נעול — החודש סגור">
                  {(props) => <Input {...props} readOnly defaultValue="1,284,050.00" dir="ltr" className="text-start" />}
                </FormField>
                <FormField label="כותרת" hint="עדיין ניתן לעריכה: לא משפיע על ההכנסות">
                  {(props) => <Input {...props} defaultValue="החלפת מערכת בקרת הכניסה בקומות 2–4" />}
                </FormField>
              </div>
            </Panel>
            <Panel>
              <p className="mb-2 text-label font-semibold text-ink-muted">שגיאות לפי סוג (ליד הפעולה, לא בהודעה קופצת)</p>
              <div className="grid gap-2">
                <FormError message={copy.errors.staleWrite} />
                <FormError message={copy.errors.offline} />
                <FormError message={copy.errors.unexpected} />
                <FormError message={copy.auth.throttled} />
                <FormError message={copy.errors.authorization} />
                <FormError message={copy.errors.sessionEndedKeepInput} />
                <Notice tone="warning">החשבונית עדיין לא התקבלה. העסקה נספרת בחודש שבו החשבונית תגיע.</Notice>
              </div>
            </Panel>
          </div>
        </Section>
      </div>

      <div id="overlays" className="scroll-mt-20">
        <Section title="שכבות" description="בטלפון: גיליון תחתון. במחשב: דיאלוג. פעולה שפותחת שכבה נוספת מחכה לסגירת הקודמת.">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialogOpen(true)}>פתיחת דיאלוג</Button>
            <Button onClick={() => setLongDialogOpen(true)}>דיאלוג עם תוכן ארוך</Button>
            <Button onClick={() => setSheetOpen(true)}>פתיחת גיליון תחתון</Button>
            <Button onClick={() => setConfirmOpen(true)}>פתיחת אישור</Button>
            <Button onClick={() => toast.show('הפעולה הושלמה')}>הודעה קצרה</Button>
          </div>
          <p className="mt-2 text-meta text-ink-subtle" data-testid="confirm-count">
            אישורים: {confirmed}
          </p>
        </Section>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="דיאלוג לדוגמה"
        description="בטלפון: גיליון תחתון. במחשב: דיאלוג ממורכז."
        testId="gallery-dialog"
        footer={
          <div className="flex gap-2.5 sm:justify-end">
            <Button variant="secondary" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">
              ביטול
            </Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">
              שמירה
            </Button>
          </div>
        }
      >
        <FormField label="שדה ראשון">{(props) => <Input {...props} />}</FormField>
      </Dialog>

      <Dialog
        open={longDialogOpen}
        onClose={() => setLongDialogOpen(false)}
        title="עריכת פרטי לקוח"
        description="תוכן ארוך גולל בתוך השכבה; כפתורי הפעולה נשארים מוצמדים למטה."
        testId="gallery-long-dialog"
        footer={
          <div className="flex gap-2.5 sm:justify-end">
            <Button variant="secondary" onClick={() => setLongDialogOpen(false)} className="flex-1 sm:flex-none">
              ביטול
            </Button>
            <Button variant="primary" onClick={() => setLongDialogOpen(false)} className="flex-1 sm:flex-none">
              שמירת הפרטים
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          {['שם מלא', 'שם העסק', 'עיר', 'רחוב ומספר', 'טלפון נייד', 'טלפון נוסף', 'דוא״ל להתכתבות', 'הערות לצוות'].map((label) => (
            <FormField key={label} label={label}>
              {(props) => (label === 'הערות לצוות' ? <Textarea {...props} rows={4} /> : <Input {...props} />)}
            </FormField>
          ))}
        </div>
      </Dialog>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onExited={() => {
          const next = openAfterSheet.current;
          openAfterSheet.current = null;
          next?.();
        }}
        title="גיליון תחתון"
        testId="gallery-sheet"
      >
        <ul className="-mx-2">
          {['פעולה ראשונה', 'פעולה שנייה'].map((label) => (
            <li key={label}>
              <button type="button" className="flex min-h-12 w-full items-center rounded-control px-3 text-row hover:bg-hover" onClick={() => setSheetOpen(false)}>
                {label}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="flex min-h-12 w-full items-center rounded-control px-3 text-row hover:bg-hover"
              onClick={() => {
                // Open the next overlay only after this sheet has finished closing.
                openAfterSheet.current = () => setDialogOpen(true);
                setSheetOpen(false);
              }}
            >
              פתיחת דיאלוג מהתפריט
            </button>
          </li>
        </ul>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        title="מחיקת הערה"
        body="ההערה תוסר מהרשימה. היא נשמרת ביומן הפעולות."
        confirmLabel="מחיקה"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          setConfirmed((count) => count + 1);
          setConfirmOpen(false);
        }}
      />
    </main>
  );
}
