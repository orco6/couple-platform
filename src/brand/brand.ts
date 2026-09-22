/**
 * BRAND AND BUSINESS LOCALE — replace per project.
 *
 * Everything that makes the app recognisably *this* business, in one file:
 * name, legal identity for documents, locale conventions. Colours, type and
 * shape live in brand/theme.css. The logo lives in brand/Logo.tsx. The favicon
 * is src/app/icon.svg.
 *
 * Core code reads these values; it never hardcodes a business name.
 */

export const brand = {
  /** Short product name: header, page titles, login. */
  appName: 'יסוד',
  /** One line under the name on the sign-in screen. */
  tagline: 'מערכת ניהול לעסק',
  /** Printed on documents (print layouts). */
  legalName: 'שם העסק בע״מ',
  /** Company / licensed-dealer number printed on documents, if any. */
  businessId: '000000000',
  address: 'רחוב, עיר',
  phone: '03-0000000',
  email: 'office@example.co.il',
} as const;

export const businessLocale = {
  /** BCP 47 language tag for <html lang>. */
  language: 'he',
  direction: 'rtl' as 'rtl' | 'ltr',
  /** The timezone every business date and displayed time is interpreted in. */
  timeZone: 'Asia/Jerusalem',
  currencyCode: 'ILS',
  currencySymbol: '₪',
} as const;
