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
    <div>
      {isMobile ? (
        <>
          <MobileTopBar onSearch={openPalette} />
          <TabBar pathname={pathname} />
        </>
      ) : (
        <TopNav pathname={pathname} onSearch={openPalette} tv={device === 'tv'} />
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
 * One top bar carrying everything: the wordmark at the left, the links beside
 * it, search at the right. No side rail — the content runs full-bleed beneath,
 * which is what makes the app feel like an application rather than a page in a
 * frame.
 *
 * It floats over the content rather than pushing it down. At the top of the
 * page it is transparent, save for a soft top-down scrim that keeps the links
 * legible over a bright hero (the Netflix/Apple-TV move); once scrolled it
 * settles into a glass bar. One backdrop-filter, only when scrolled.
 */
function TopNav({ pathname, onSearch, tv }: { pathname: string | null; onSearch: () => void; tv: boolean }) {
  const scrolled = useScrolled(24);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex h-topbar items-center gap-4 px-gutter
                  transition-colors duration-300 ease-physical sm:gap-6
                  ${scrolled
                    ? 'border-b border-white/[0.06] bg-ink-900/70 backdrop-blur-xl'
                    : 'border-b border-transparent bg-gradient-to-b from-ink-950/85 via-ink-950/35 to-transparent'}`}
    >
      <Link href="/" aria-label="Animux home" className="shrink-0 rounded-key outline-none">
        <Wordmark tv={tv} />
      </Link>

      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {LINKS.map(({ href, label }) => {
          const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative rounded-full px-3.5 font-semibold transition-colors duration-200 ease-physical
                          ${tv ? 'py-2.5 text-lead' : 'py-2 text-meta'}
                          ${active ? 'text-paper' : 'text-haze hover:text-paper'}`}
            >
              {label}
              {active && (
                <span
                  className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-chroma"
                  aria-hidden
                />
              )}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onSearch}
        className={`ml-auto flex items-center gap-2.5 rounded-full border border-white/[0.1]
                    bg-white/[0.06] px-4 py-2 text-meta text-haze backdrop-blur-md transition-colors
                    hover:border-white/20 hover:text-paper ${tv ? 'w-72' : 'w-56 lg:w-64'}`}
      >
        <Search size={16} aria-hidden />
        <span className="flex-1 truncate text-left">Search anime</span>
        {!tv && (
          <kbd className="rounded border border-white/15 bg-ink-950/50 px-1.5 py-0.5 font-sans text-[10px]">
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
                  ${scrolled
                    ? 'border-b border-white/[0.06] bg-ink-900/75 backdrop-blur-xl'
                    : 'bg-gradient-to-b from-ink-950/85 to-transparent'}`}
    >
      <Link href="/" aria-label="Animux home"><Wordmark /></Link>
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
 * The compact glyph — the initial and the x, the one letter the name gives us
 * for free, which doubles as a play head. Kept for tight spots.
 */
function Mark() {
  return (
    <span className="font-display text-[19px] font-black leading-none tracking-tight text-paper">
      a<span className="text-chroma">x</span>
    </span>
  );
}

/**
 * The full wordmark, for the top-left of the bar. A proper size so it reads as
 * the app's name, with the play-triangle before it and the "ux" carrying the
 * artwork colour of whatever is on screen.
 */
function Wordmark({ tv }: { tv?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={tv ? 'h-6 w-6' : 'h-[22px] w-[22px]'}
        style={{ color: 'rgb(var(--chroma))' }}
      >
        <path d="M4 3.5 20 12 4 20.5z" fill="currentColor" />
      </svg>
      <span
        className={`font-display font-black leading-none tracking-[-0.03em] text-paper
                    ${tv ? 'text-[30px]' : 'text-[23px]'}`}
      >
        anim<span className="text-chroma">ux</span>
      </span>
    </span>
  );
}
