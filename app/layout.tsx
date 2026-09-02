import type { Metadata, Viewport } from 'next';
import { Zen_Kaku_Gothic_New, Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';
import { SplashGate } from '@/components/brand/SplashGate';

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
  title: { default: 'Animux', template: '%s · Animux' },
  description: 'Watch anime with subtitles and dubs in the language you want, on any screen.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Animux' },
  formatDetection: { telephone: false },
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
        {/* An overlay, deliberately after the shell in the tree: the app is
            already rendered and interactive underneath while it plays. */}
        <AppShell>{children}</AppShell>
        <SplashGate />
      </body>
    </html>
  );
}
