'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Bookmark, Settings2 } from 'lucide-react';
import { useDevice } from '@/hooks/useDevice';
import { useSpatialNav } from '@/hooks/useSpatialNav';

/**
 * The navigation is the part of this app that has to survive being wrapped in
 * an Android shell or thrown at a television, so its shape is decided by the
 * device rather than by a breakpoint on a sidebar.
 *
 *   mobile   bottom tab bar, thumb-reachable, above the gesture inset
 *   desktop  slim icon rail on the left
 *   tv       wider rail, larger targets, labels always visible
 *
 * Same links, same components, three postures.
 */

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/browse', label: 'Browse', icon: Search },
  { href: '/library', label: 'Library', icon: Bookmark },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const device = useDevice();
  const pathname = usePathname();

  useSpatialNav(device === 'tv');

  // The player owns the whole screen; navigation would only be in the way.
  const immersive = pathname?.startsWith('/watch');

  if (immersive) return <>{children}</>;

  const isMobile = device === 'mobile';

  return (
    <div className={isMobile ? '' : 'pl-rail'}>
      {isMobile ? <TabBar pathname={pathname} /> : <SideRail pathname={pathname} tv={device === 'tv'} />}
      <main className={isMobile ? 'pb-[calc(72px+env(safe-area-inset-bottom))]' : ''}>{children}</main>
    </div>
  );
}

function SideRail({ pathname, tv }: { pathname: string | null; tv: boolean }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 flex w-rail flex-col items-center
                 gap-1 border-r border-ink-700/60 bg-ink-900/80 py-6 backdrop-blur-xl"
    >
      <Link href="/" className="mb-6 rounded-key px-2 py-1" aria-label="Animux home">
        <Mark />
      </Link>

      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`group flex w-[84%] flex-col items-center gap-1.5 rounded-panel py-3
                        transition-colors duration-200 ease-physical
                        ${active ? 'bg-ink-700 text-paper' : 'text-haze hover:bg-ink-800 hover:text-paper'}`}
          >
            <Icon size={tv ? 26 : 20} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
            <span className={`${tv ? 'text-meta' : 'text-micro'} font-medium`}>{label}</span>
          </Link>
        );
      })}
    </nav>
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
        {LINKS.map(({ href, label, icon: Icon }) => {
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
