'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { Check, Play, X } from 'lucide-react';
import { useLibrary } from '@/store/useLibrary';

/**
 * The in-player episode switcher — a floating glass panel rather than a trip
 * back to the title page, so jumping two episodes ahead costs one tap
 * instead of a full navigation and reload of everything else on that page.
 *
 * Deliberately built from data the player already has (the local watch-
 * progress store, the show's own cover art as every row's thumbnail) rather
 * than fetching per-episode artwork the moment the drawer opens — that data
 * exists (`EpisodeList` on the title page renders it), but this player is
 * not the place to add a second network round trip for it. What this drawer
 * shows — which episodes exist, which are watched, which is playing now —
 * is real, not a placeholder; it is only the per-episode artwork that is a
 * shared thumbnail rather than a unique frame.
 */
export function EpisodeDrawer({
  open,
  onClose,
  animeId,
  cover,
  currentEpisode,
  totalEpisodes,
}: {
  open: boolean;
  onClose: () => void;
  animeId: string;
  cover: string;
  currentEpisode: number;
  totalEpisodes: number | null;
}) {
  const progress = useLibrary((s) => s.progress);

  // An unbounded or unknown episode count (an airing show with no total yet)
  // gets a window around where the viewer actually is, not a scroll to
  // infinity — nobody opens this to browse from episode 1 of an 800-episode
  // show, they open it to jump a few episodes in either direction.
  const episodes = useMemo(() => {
    const count = totalEpisodes ?? currentEpisode + 24;
    if (totalEpisodes) return Array.from({ length: count }, (_, i) => i + 1);
    const start = Math.max(1, currentEpisode - 6);
    return Array.from({ length: count - start + 1 }, (_, i) => start + i);
  }, [totalEpisodes, currentEpisode]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close episode list"
        onClick={onClose}
        className="fixed inset-0 z-30 cursor-default bg-black/50 backdrop-blur-[2px] animate-fade"
      />
      <aside
        role="dialog"
        aria-label="Episodes"
        className="glass fixed inset-y-0 right-0 z-30 flex w-[320px] max-w-[86vw] flex-col
                   overflow-hidden !rounded-none border-l border-white/10 animate-[slideIn_0.3s_var(--ease-physical)_both]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
          <h2 className="font-display text-title font-bold text-paper">Episodes</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-haze transition-colors hover:bg-white/10 hover:text-paper"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <ul className="flex-1 overflow-y-auto p-2">
          {episodes.map((ep) => {
            const entry = progress.find((p) => p.animeId === animeId && p.episode === ep);
            const pct = entry && entry.duration > 0 ? (entry.position / entry.duration) * 100 : 0;
            const done = pct >= 92;
            const active = ep === currentEpisode;

            return (
              <li key={ep}>
                <Link
                  href={`/watch/${animeId}?ep=${ep}`}
                  onClick={onClose}
                  className={`group relative flex items-center gap-3 rounded-key p-2 transition-colors duration-150
                              ${active ? 'bg-chroma/15' : 'hover:bg-white/[0.06]'}`}
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-ink-700">
                    <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-ink-950/45 opacity-0 transition-opacity group-hover:opacity-100">
                      {done ? <Check size={16} className="text-paper" aria-hidden /> : <Play size={14} className="fill-paper text-paper" aria-hidden />}
                    </span>
                    {pct > 0 && (
                      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-950/70">
                        <span className="block h-full bg-chroma" style={{ width: `${Math.min(100, pct)}%` }} />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className={`block text-meta font-semibold ${active ? 'text-chroma' : 'text-paper'}`}>
                      Episode {ep}
                    </span>
                    <span className="block text-micro text-haze/70">
                      {done ? 'Watched' : entry ? 'In progress' : active ? 'Now playing' : ''}
                    </span>
                  </span>

                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chroma shadow-[0_0_8px_2px_rgb(var(--chroma)/0.8)]" aria-hidden />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}
