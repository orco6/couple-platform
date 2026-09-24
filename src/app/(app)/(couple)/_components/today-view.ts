/** How Today's list is arranged: all together, or each person's own (mine first). Remembered in a cookie so the first paint is already right. */
export const TODAY_VIEW_COOKIE = 'today-view';
export type TodayView = 'together' | 'person';

export function readTodayView(value: string | undefined): TodayView {
  return value === 'person' ? 'person' : 'together';
}
