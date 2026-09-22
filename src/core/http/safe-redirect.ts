/**
 * Open-redirect protection for `?next=` style parameters.
 *
 * Only same-site relative paths survive. Anything that a browser could resolve
 * to another origin — "//evil.com", "/\evil.com", "https://…", "javascript:",
 * encoded control characters — becomes "/".
 */
export function safeRedirectPath(input: string | null | undefined, fallback = '/'): string {
  if (!input || typeof input !== 'string') return fallback;
  let value = input.trim();
  try {
    // Decode once, so "%2F%2Fevil.com" is judged as what the browser will see.
    if (/%[0-9a-f]{2}/i.test(value)) value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (value.length > 512) return fallback;
  try {
    const resolved = new URL(value, 'https://placeholder.invalid');
    if (resolved.origin !== 'https://placeholder.invalid') return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
