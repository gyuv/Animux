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

  const tv = device === 'tv';

  return (
    <div>
      <TopBar onSearch={openPalette} tv={tv} />
      <BubbleNav pathname={pathname} tv={tv} />

      {/* Clear the floating bubble at the bottom on every device. */}
      <main className="pb-[calc(96px+env(safe-area-inset-bottom))]">{children}</main>

      <CommandPalette open={palette} onClose={closePalette} />
    </div>
  );
}

/* --------------------------------------------------------------- desktop */

/**
 * A slim top bar with only the wordmark and search — no links, because the menu
 * now lives in the bubble below. Transparent over a hero (a soft top-down scrim
 * keeps the mark legible), settling into the nav material once scrolled.
 */
function TopBar({ onSearch, tv }: { onSearch: () => void; tv: boolean }) {
  const scrolled = useScrolled(24);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex h-topbar items-center gap-3 px-gutter
                  transition-colors duration-300 ease-physical
                  ${scrolled
                    ? 'nav-glass rounded-none border-x-0 border-t-0'
                    : 'border-b border-transparent bg-gradient-to-b from-ink-950/85 via-ink-950/30 to-transparent'}`}
    >
      <Link href="/" aria-label="Animux home" className="shrink-0 rounded-key outline-none">
        <Wordmark tv={tv} />
      </Link>

      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className={`ml-auto flex items-center gap-2.5 rounded-full border border-white/[0.1]
                    bg-white/[0.06] text-haze transition-colors hover:border-white/20 hover:text-paper
                    ${tv ? 'w-64 px-4 py-2.5 text-lead' : 'px-4 py-2 text-meta sm:w-56 lg:w-64'}`}
    >
        <Search size={tv ? 20 : 16} aria-hidden />
        <span className="flex-1 truncate text-left max-sm:hidden">Search anime</span>
        {!tv && (
          <kbd className="rounded border border-white/15 bg-ink-950/50 px-1.5 py-0.5 font-sans text-[10px] max-sm:hidden">
            ⌘K
          </kbd>
        )}
      </button>
    </header>
  );
}

/**
 * The menu, as a floating transparent bubble at the bottom — icons only, and
 * the one you are on (or the one focus lands on, via a remote) expands to show
 * its label while the rest stay compact. One nav for every device: thumb-reach
 * on a phone, D-pad-reachable on a TV, and a tidy dock on a desktop.
 *
 * The expand is a max-width + opacity transition on the label, so it is GPU
 * cheap and reversible; on a TV the material goes solid (see .nav-glass) and
 * the transitions shorten (.tv-calm) so the remote never feels behind.
 */
function BubbleNav({ pathname, tv }: { pathname: string | null; tv: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center
                 px-gutter pb-[max(14px,env(safe-area-inset-bottom))]"
    >
      <ul className="nav-glass tv-calm pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                title={label}
                className={`group flex items-center rounded-full outline-none active:scale-95
                            transition-[background-color,color,padding] duration-300 ease-physical
                            ${tv ? 'gap-2.5 px-4 py-3' : 'gap-2 px-3.5 py-2.5'}
                            ${active
                              ? 'bg-[rgb(var(--chroma)/0.2)] text-chroma'
                              : 'text-haze hover:text-paper focus-visible:text-paper'}`}
              >
                <Icon size={tv ? 25 : 22} strokeWidth={active ? 2.5 : 1.9} aria-hidden className="shrink-0" />
                <span
                  className={`overflow-hidden whitespace-nowrap font-semibold
                              ${tv ? 'text-lead' : 'text-meta'}
                              transition-[max-width,opacity,margin] duration-300 ease-physical
                              ${active
                                ? 'ml-0.5 max-w-[8rem] opacity-100'
                                : 'max-w-0 opacity-0 group-hover:ml-0.5 group-hover:max-w-[8rem] group-hover:opacity-100 group-focus-visible:ml-0.5 group-focus-visible:max-w-[8rem] group-focus-visible:opacity-100'}`}
                >
                  {label}
                </span>
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
