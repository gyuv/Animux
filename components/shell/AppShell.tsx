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

/**
 * A floating capsule dock rather than a full-height edge rail.
 *
 * It hovers, vertically centred, off the left edge as a single glass pill, and
 * expands on hover — or on keyboard focus reaching it — to slide the labels out
 * beside their icons. Collapsed it is a column of icons; the labels stay in the
 * DOM the whole time, so a screen reader always has them and only the visual
 * width changes. Everything here is a CSS width/opacity transition — no
 * per-frame JavaScript, no measuring — so it costs nothing to run. On a TV it
 * simply starts expanded, since a remote has no hover.
 */
function SideRail({ pathname, tv }: { pathname: string | null; tv: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-y-0 left-0 z-40 flex w-rail items-center justify-center"
    >
      <div
        className={`group pointer-events-auto flex flex-col gap-1 overflow-hidden rounded-[26px]
                    border border-white/[0.08] bg-ink-900/70 p-2 backdrop-blur-xl
                    shadow-[0_30px_80px_-32px_rgb(0_0_0/0.9),0_0_0_1px_rgb(0_0_0/0.3)]
                    transition-[width] duration-300 ease-physical
                    ${tv ? 'w-56' : 'w-[54px] hover:w-52 focus-within:w-52'}`}
    >
        <Link
          href="/"
          aria-label="Animux home"
          className="mb-1 flex h-11 items-center gap-3 rounded-2xl px-[13px]"
        >
          <span className="grid w-7 shrink-0 place-items-center"><Mark /></span>
          <span
            className={`whitespace-nowrap font-display text-lead font-black tracking-tight text-paper
                        transition-opacity duration-200
                        ${tv ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
          >
            anim<span className="text-chroma">ux</span>
          </span>
        </Link>

        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              title={label}
              className={`relative flex h-11 items-center gap-3 rounded-2xl px-[13px]
                          transition-colors duration-200 ease-physical
                          ${active
                            ? 'bg-[rgb(var(--chroma)/0.16)] text-chroma'
                            : 'text-haze hover:bg-ink-800 hover:text-paper'}`}
            >
              <span className="grid w-7 shrink-0 place-items-center">
                <Icon size={tv ? 24 : 21} strokeWidth={active ? 2.5 : 1.9} aria-hidden />
              </span>
              <span
                className={`whitespace-nowrap ${tv ? 'text-meta' : 'text-meta'} font-semibold
                            transition-opacity duration-200
                            ${tv ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
              >
                {label}
              </span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-chroma" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
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

/**
 * A floating glass pill in the thumb zone rather than an edge-to-edge bar — the
 * same capsule material as the desktop dock, so the two form factors read as
 * one system. The active tab carries a chroma-tinted lozenge that its label
 * slides into; tapping presses it in (active:scale) for a tactile response.
 */
function TabBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center
                 pb-[max(12px,env(safe-area-inset-bottom))] px-gutter"
    >
      <ul
        className="flex items-center gap-1 rounded-full border border-white/[0.09]
                   bg-ink-900/75 p-1.5 backdrop-blur-xl
                   shadow-[0_20px_50px_-18px_rgb(0_0_0/0.9)]"
      >
        {MOBILE_LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={`flex items-center gap-2 rounded-full px-3.5 py-2.5
                            transition-[background,color,transform] duration-200 ease-physical
                            active:scale-95
                            ${active
                              ? 'bg-[rgb(var(--chroma)/0.18)] text-chroma'
                              : 'text-haze active:bg-ink-800'}`}
              >
                <Icon size={21} strokeWidth={active ? 2.5 : 1.9} aria-hidden />
                {active && <span className="text-meta font-semibold">{label}</span>}
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
