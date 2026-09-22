/**
 * BUSINESS SETTINGS — replace per project.
 *
 * Only values the business changes without a developer (thresholds, default
 * rates). Records that used a value store the value they used. Example:
 *
 *   'vat.default_rate_bps': defineSetting({
 *     label: 'שיעור מע״מ ברירת מחדל', description: '…',
 *     schema: z.number().int().min(0).max(5000), defaultValue: 1800, input: { kind: 'rate_bps' },
 *   }),
 */

export const settingDefinitions = {} as const;
