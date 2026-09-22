/**
 * Navigation items are data (serializable), so the server can filter them by
 * permission and hand them to client components. Icons are referenced by name.
 */
export type NavIconName =
  | 'home'
  | 'users'
  | 'list'
  | 'flag'
  | 'chart'
  | 'settings'
  | 'archive'
  | 'history'
  | 'user'
  | 'layers';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** 'bar' = in the mobile bottom bar (max 4); 'more' = in the "more" sheet. */
  mobile: 'bar' | 'more';
  /** Group heading on desktop, e.g. "ניהול". Items without a group come first. */
  group?: string;
  /** Match nested routes as active. Default true. */
  matchPrefix?: boolean;
}
