import type { Metadata, Viewport } from 'next';
import { Rubik } from 'next/font/google';
import { headers } from 'next/headers';
import { brand, businessLocale } from '@/brand/brand';
import { ToastProvider } from '@/core/ui/components/Toast';
import './globals.css';

/**
 * Root layout.
 *
 * Font: **Rubik**, one family for everything — the typographic approach
 * recorded for Tovli in docs/KOMA_TOVLI_EXTRACTION_REPORT.md §5, with the
 * discipline from §2: the scale tops out at 22px and weight 600 does the work
 * that size would otherwise do.
 *
 * One family rather than a sans/serif pair is the point. A display serif reads
 * as editorial — a concept — and this is a consumer app whose polish has to
 * come from weight, spacing and light instead.
 *
 * Rubik was drawn with Hebrew from the start, so a mixed Hebrew/Latin line
 * shares one skeleton and one rhythm. Self-hosted by next/font (no request to
 * Google at runtime), Hebrew and Latin subsets. Replace in brand/ per project
 * by changing this import and --brand-font-sans.
 *
 * Rendering is dynamic: the Content-Security-Policy uses a per-request nonce
 * (src/proxy.ts), which static prerendering cannot carry.
 */
const brandSans = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: brand.appName, template: `%s · ${brand.appName}` },
  description: brand.tagline || brand.appName,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Both schemes, so the browser chrome blends into the app instead of framing
  // it. Values are --brand-canvas from brand/theme.css.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdf8f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1428' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading a request header opts the tree into dynamic rendering (needed for the CSP nonce).
  await headers();
  return (
    <html
      lang={businessLocale.language}
      dir={businessLocale.direction}
      className={brandSans.variable}
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
