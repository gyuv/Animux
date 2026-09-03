'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Home, Compass, CalendarDays, Bookmark, Settings2, Search } from 'lucide-react';
import { useDevice } from '@/hooks/useDevice';
import { useSpatialNav } from '@/hooks/useSpatialNav';
import { CommandPalette } from '@/components/search/CommandPalette';

/**
 * The navigation is the part of this app that has to survive being wrapped in
 * an Android shell or thrown at a television, so its shape is decided by the
 * device rather than by a breakpoint on a sidebar.
 *
 *   mobile   bottom tab bar, thumb-reachable, above the gesture inset
 *   desktop  slim icon rail on the left, plus a top bar carrying search
 *   tv       wider rail, larger targets, labels always visible
 *
 * Same links, same components, three postures.
 */

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/browse', label: 'Browse', icon: Compass },
  { href: '/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/library', label: 'Library', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

/** Mobile keeps four tabs; the schedule lives one tap in from Browse. */
const MOBILE_LINKS = LINKS.filter((l) => l.href !== '/settings');

export function AppShell({ children }: { children: React.ReactNode }) {
  const device = useDevice();
  const pathname = usePathname();
  const [palette, setPalette] = useState(false);

  useSpatialNav(device === 'tv');

  const openPalette = useCallback(() => setPalette(true), []);
  const closePalette = useCallback(() => setPalette(false), []);

  // Cmd/Ctrl-K anywhere, and plain "/" when the viewer is not already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette((v) => !v);
      } else if (e.key === '/' && !typing && !palette) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palette]);

  // The player owns the whole screen; navigation would only be in the way.
  const immersive = pathname?.startsWith('/watch');
  if (immersive) return <>{children}</>;

  const isMobile = device === 'mobile';

  return (
    <div className={isMobile ? '' : 'pl-rail'}>
      {isMobile ? (
        <>
          <MobileTopBar onSearch={openPalette} />
          <TabBar pathname={pathname} />
        </>
      ) : (
        <>
          <SideRail pathname={pathname} tv={device === 'tv'} />
          <TopBar onSearch={openPalette} tv={device === 'tv'} />
        </>
      )}

      <main
        className={
          isMobile
            ? 'pb-[calc(72px+env(safe-area-inset-bottom))]'
            : ''
        }
      >
        {children}
      </main>

      <CommandPalette open={palette} onClose={closePalette} />
    </div>
  );
}

/* --------------------------------------------------------------- desktop */

function SideRail({ pathname, tv }: { pathname: string | null; tv: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 flex w-rail flex-col items-center
                 gap-1 border-r border-ink-700/60 bg-ink-900/80 py-5 backdrop-blur-xl"
    >
      <Link href="/" className="mb-5 rounded-key px-2 py-1" aria-label="Animux home">
        <Mark />
      </Link>

      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex w-[84%] flex-col items-center gap-1.5 rounded-panel py-3
                        transition-colors duration-200 ease-physical
                        ${active ? 'bg-ink-700 text-paper' : 'text-haze hover:bg-ink-800 hover:text-paper'}`}
          >
            {active && (
              <span
                className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-chroma"
                aria-hidden
              />
            )}
            <Icon size={tv ? 26 : 20} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
            <span className={`${tv ? 'text-meta' : 'text-micro'} font-medium`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The top bar exists for one control — search — and turns transparent at the
 * top of the page so it never puts a bar across the middle of a hero image.
 */
function TopBar({ onSearch, tv }: { onSearch: () => void; tv: boolean }) {
  const scrolled = useScrolled(24);

  return (
    <header
      className={`fixed inset-x-0 left-rail top-0 z-30 flex h-topbar items-center justify-end gap-3
                  px-gutter transition-colors duration-300 ease-physical
                  ${scrolled ? 'border-b border-ink-700/50 bg-ink-900/80 backdrop-blur-xl' : 'bg-transparent'}`}
    >
      <button
        type="button"
        onClick={onSearch}
        className={`flex items-center gap-2.5 rounded-key border border-ink-600/80 bg-ink-800/60
                    px-3.5 py-2 text-meta text-haze backdrop-blur-md transition-colors
                    hover:border-ink-500 hover:text-paper ${tv ? 'w-72' : 'w-64'}`}
      >
        <Search size={16} aria-hidden />
        <span className="flex-1 text-left">Search anime</span>
        {!tv && (
          <kbd className="rounded border border-ink-600 bg-ink-900/70 px-1.5 py-0.5 font-sans text-[10px]">
            ⌘K
          </kbd>
        )}
      </button>
    </header>
  );
}

/* ---------------------------------------------------------------- mobile */

function MobileTopBar({ onSearch }: { onSearch: () => void }) {
  const scrolled = useScrolled(16);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 flex h-topbar items-center gap-3 px-gutter
                  transition-colors duration-300
                  ${scrolled ? 'border-b border-ink-700/50 bg-ink-900/85 backdrop-blur-xl' : 'bg-transparent'}`}
    >
      <Link href="/" aria-label="Animux home"><Mark /></Link>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="ml-auto flex items-center gap-2 rounded-key border border-ink-600/80
                   bg-ink-800/60 px-3 py-2 text-meta text-haze backdrop-blur-md"
      >
        <Search size={16} aria-hidden />
        Search
      </button>
    </header>
  );
}

function TabBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/60
                 bg-ink-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="flex">
        {MOBILE_LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5
                            ${active ? 'text-paper' : 'text-haze'}`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                  {active && (
                    <span
                      className="absolute -top-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-chroma"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="text-micro font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ bits */

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/**
 * The wordmark is set in the display face and leans on the one glyph the name
 * gives us for free — the x — which doubles as a play head when clipped.
 */
function Mark() {
  return (
    <span className="font-display text-[19px] font-black leading-none tracking-tight text-paper">
      a<span className="text-chroma">x</span>
    </span>
  );
}
