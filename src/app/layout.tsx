import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Hebrew } from 'next/font/google';
import { headers } from 'next/headers';
import { brand, businessLocale } from '@/brand/brand';
import { ToastProvider } from '@/core/ui/components/Toast';
import './globals.css';

/**
 * Root layout.
 *
 * Font: IBM Plex Sans Hebrew — a Hebrew face designed together with its Latin,
 * so mixed Hebrew/English lines share one rhythm, with real tabular figures.
 * Self-hosted by next/font (no request to Google at runtime). Replace in
 * brand/ per project by changing this import and --brand-font-sans.
 *
 * Rendering is dynamic: the Content-Security-Policy uses a per-request nonce
 * (src/proxy.ts), which static prerendering cannot carry.
 */
const brandSans = IBM_Plex_Sans_Hebrew({
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
  themeColor: '#f2f1ec',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading a request header opts the tree into dynamic rendering (needed for the CSP nonce).
  await headers();
  return (
    <html lang={businessLocale.language} dir={businessLocale.direction} className={brandSans.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
