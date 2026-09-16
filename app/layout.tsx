import type { Metadata, Viewport } from 'next';
import { Orbitron, Plus_Jakarta_Sans, Zen_Kaku_Gothic_New } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';

/**
 * Orbitron carries the display type — the geometric, high-voltage face the
 * neon identity is built around. It has no CJK glyphs, so native titles
 * (進撃の巨人) are set in Zen Kaku Gothic New instead via `font-native`
 * rather than being left to fall back to whatever generic sans the OS picks
 * mid-string.
 */
const display = Orbitron({
  weight: ['700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const native = Zen_Kaku_Gothic_New({
  weight: ['700', '900'],
  subsets: ['latin'],
  variable: '--font-native',
  display: 'swap',
});

const ui = Plus_Jakarta_Sans({
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
  themeColor: '#080810',
  width: 'device-width',
  initialScale: 1,
  // Locked so a double-tap on the player doesn't zoom the page instead of seeking.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-device="desktop" className={`${display.variable} ${native.variable} ${ui.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
