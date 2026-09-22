/**
 * BUSINESS SETTINGS — replace per project.
 *
 * Only settings the business genuinely changes without a developer. Thresholds
 * and rates, not feature flags and not every constant in the code base.
 * Settings never retroactively change history: a record that used a rate
 * stores the rate it used (see Task.vatRateBps).
 */

import { z } from 'zod';
import { defineSetting } from '@/core/settings/define-setting';

export const settingDefinitions = {
  'vat.default_rate_bps': defineSetting({
    label: 'שיעור מע״מ ברירת מחדל',
    description: 'השיעור שנשמר על משימה בעת קביעת המחיר. שינוי כאן לא משנה משימות שכבר תומחרו.',
    schema: z.number().int().min(0).max(5000),
    defaultValue: 1800,
    input: { kind: 'rate_bps' },
  }),
  'tasks.due_soon_days': defineSetting({
    label: 'התראה על משימה שמועד היעד שלה מתקרב (ימים)',
    description: 'משימות פתוחות שמועד היעד שלהן בטווח הזה יופיעו ברשימת "לטיפול".',
    schema: z.number().int().min(0).max(60),
    defaultValue: 3,
    input: { kind: 'integer', min: 0, max: 60, unit: 'ימים' },
  }),
} as const;
