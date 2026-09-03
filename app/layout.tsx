import type { Metadata, Viewport } from 'next';
import { Zen_Kaku_Gothic_New, Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';

/**
 * Zen Kaku Gothic New carries the display type. It is a Japanese gothic, which
 * matters practically as well as tonally: the interface shows native titles
 * (進撃の巨人) beside romaji, and a Latin-only display face would fall back to
 * something mismatched the moment it hit kana.
 */
const display = Zen_Kaku_Gothic_New({
  weight: ['700', '900'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const ui = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: 'Animux — watch anime, in your language', template: '%s · Animux' },
  description: 'Watch anime with subtitles and dubs in the language you want, on any screen.',
  applicationName: 'Animux',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Animux' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'Animux',
    title: 'Animux',
    description: 'Watch anime with subtitles and dubs in the language you want, on any screen.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0E0B16',
  width: 'device-width',
  initialScale: 1,
  // Locked so a double-tap on the player doesn't zoom the page instead of seeking.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-device="desktop" className={`${display.variable} ${ui.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
