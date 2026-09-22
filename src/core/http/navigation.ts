/**
 * A full page load, used ONLY when the session changes (sign-in, sign-out,
 * password change, session expiry). A client-side router push would keep
 * server components and the router cache rendered for the previous session;
 * a real navigation guarantees every piece of UI is rebuilt for the new one.
 * Everything else navigates with next/navigation.
 */
export function navigateAfterSessionChange(path: string): void {
  window.location.assign(path);
}
