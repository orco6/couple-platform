/**
 * Domain copy — selected by locale.
 *
 * WHY THIS EXISTS (BUSINESS_RULES.md → D-8). The first real version is
 * Hebrew-first and RTL-first, but adding English later must not be a rewrite.
 * So:
 *
 *   • every user-facing domain sentence is a value in a dictionary, keyed by
 *     concept — never a literal in a component;
 *   • `Dictionary` is the *type of the Hebrew dictionary*, so a second
 *     language is a compile error until it supplies every key with the same
 *     shape (including the interpolating functions and their arguments);
 *   • language and direction come from `businessLocale` in src/brand/brand.ts,
 *     and every layout uses logical properties, so `direction: 'ltr'` is the
 *     only layout change English needs.
 *
 * WHAT IS STILL MISSING for a real second language, stated plainly so nobody
 * discovers it late:
 *   • core's own Hebrew copy (`src/core/copy.ts`) — sign-in, validation, the
 *     admin screens — is a single Hebrew file. Giving core a dictionary is a
 *     core change and therefore needs an ADR (FOUNDATION §1, §12: "languages
 *     other than Hebrew" is explicitly not included).
 *   • date and number formatting is composed by hand in core (ADR 0005) in
 *     DD.MM.YYYY; another locale's order would be a core change too.
 *   • Hebrew grammatical gender: the copy here uses neutral forms or the
 *     "סגר/ה" pattern. English has no equivalent problem, but a third
 *     language might need plural rules richer than the `(n) => string`
 *     functions used here.
 *
 * So this module makes the *domain* i18n-ready. The platform underneath it is
 * not, and pretending otherwise would be the more expensive mistake.
 */

import { businessLocale } from '@/brand/brand';

import { he } from './he';

/** The contract a second language must satisfy, in full. */
export type Dictionary = typeof he;

const dictionaries = {
  he,
} satisfies Record<string, Dictionary>;

type SupportedLanguage = keyof typeof dictionaries;

function isSupported(language: string): language is SupportedLanguage {
  return language in dictionaries;
}

/**
 * The active dictionary. Hebrew is the fallback rather than an error: a
 * mis-set locale should show the product in Hebrew, not break every screen.
 */
export const copy: Dictionary = isSupported(businessLocale.language)
  ? dictionaries[businessLocale.language]
  : he;
