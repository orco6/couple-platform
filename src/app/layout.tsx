import type { Metadata, Viewport } from 'next';
import { Assistant, Noto_Serif_Hebrew } from 'next/font/google';
import { headers } from 'next/headers';
import { brand, businessLocale } from '@/brand/brand';
import { ToastProvider } from '@/core/ui/components/Toast';
import './globals.css';

/**
 * Root layout.
 *
 * Fonts (brand/theme.css explains why): Assistant carries the interface —
 * a warm humanist Hebrew face that stays legible at 14px on a phone in the
 * dark — and Noto Serif Hebrew carries anything the couple reads emotionally:
 * the day, the verdict, the figures. Two faces, one job each; hierarchy still
 * comes from weight before size.
 *
 * Both are self-hosted by next/font (no request to Google at runtime), and
 * both are loaded with the Hebrew and Latin subsets so a mixed line shares one
 * rhythm. Replace in brand/ per project by changing these imports and
 * --brand-font-sans / --brand-font-display.
 *
 * Rendering is dynamic: the Content-Security-Policy uses a per-request nonce
 * (src/proxy.ts), which static prerendering cannot carry.
 */
const brandSans = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-sans',
  display: 'swap',
});

const brandDisplay = Noto_Serif_Hebrew({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-brand-display',
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
    { media: '(prefers-color-scheme: light)', color: '#f7f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1620' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading a request header opts the tree into dynamic rendering (needed for the CSP nonce).
  await headers();
  return (
    <html
      lang={businessLocale.language}
      dir={businessLocale.direction}
      className={`${brandSans.variable} ${brandDisplay.variable}`}
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
