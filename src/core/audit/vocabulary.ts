/**
 * Audit vocabulary: which actions exist, how they read, which need a reason,
 * and how stored field values are shown to a reviewer.
 *
 * Core defines the platform's own actions. The domain adds its own through
 * `defineAuditVocabulary` in src/domain/audit.ts, merged in the contract.
 * Actions are strings (not a database enum) so adding one never needs a
 * migration.
 */

export type AuditFieldFormat = 'text' | 'money' | 'calendar_date' | 'instant' | 'boolean' | 'rate' | 'enum' | 'reference';

export interface AuditFieldDefinition {
  label: string;
  format?: AuditFieldFormat;
  /** For format 'enum': stored value → label. */
  values?: Record<string, string>;
}

export interface AuditActionDefinition {
  label: string;
  requiresReason?: boolean;
}

export interface AuditVocabulary<A extends string = string> {
  entityTypes: Record<string, string>;
  actions: Record<A, AuditActionDefinition>;
  /** Field order here is the order a reviewer reads them in. */
  fields: Record<string, AuditFieldDefinition>;
}

export function defineAuditVocabulary<const A extends string>(vocabulary: AuditVocabulary<A>): AuditVocabulary<A> {
  return vocabulary;
}

export const coreAuditVocabulary = defineAuditVocabulary({
  entityTypes: {
    user: 'משתמש',
    setting: 'הגדרה',
    period: 'תקופה',
    follow_up: 'פריט מעקב',
  },
  actions: {
    'auth.signed_in': { label: 'התחברות' },
    'auth.password_changed': { label: 'סיסמה שונתה' },
    'auth.sessions_revoked': { label: 'כל החיבורים נותקו' },
    'user.created': { label: 'משתמש נוצר' },
    'user.updated': { label: 'פרטי משתמש עודכנו' },
    'user.role_changed': { label: 'תפקיד שונה' },
    'user.disabled': { label: 'משתמש הושבת' },
    'user.enabled': { label: 'משתמש הופעל מחדש' },
    'user.password_reset': { label: 'סיסמה אופסה על ידי מנהל' },
    'user.bootstrapped': { label: 'משתמש ראשון נוצר' },
    'setting.changed': { label: 'הגדרה שונתה' },
    'period.closed': { label: 'תקופה נסגרה' },
    'period.reopened': { label: 'תקופה נפתחה מחדש', requiresReason: true },
    'follow_up.created': { label: 'פריט מעקב נפתח' },
    'follow_up.resolved': { label: 'פריט מעקב טופל' },
    'follow_up.dismissed': { label: 'פריט מעקב בוטל' },
  },
  fields: {
    name: { label: 'שם' },
    username: { label: 'שם משתמש' },
    email: { label: 'דוא״ל' },
    role: { label: 'תפקיד', format: 'enum' },
    status: { label: 'סטטוס', format: 'enum' },
    mustChangePassword: { label: 'נדרשת החלפת סיסמה', format: 'boolean' },
    value: { label: 'ערך' },
    kind: { label: 'סוג' },
    note: { label: 'הערה' },
    dueDate: { label: 'תאריך יעד', format: 'calendar_date' },
    resolution: { label: 'אופן הטיפול' },
  },
});

export type CoreAuditAction = keyof typeof coreAuditVocabulary.actions;
