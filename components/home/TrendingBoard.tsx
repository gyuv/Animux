'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';

/**
 * The ranked board that sits beside the grid.
 *
 * Three tabs, and they are the three the catalogue can actually answer:
 * what is being opened right now, what has the largest audience overall, and
 * what scores highest. Sites in this shape usually label these Day / Week /
 * Month — a window this data has no notion of, so those labels would be three
 * different lies about the same list.
 */

export interface Board {
  id: string;
  label: string;
  items: Anime[];
}

export function TrendingBoard({ boards }: { boards: Board[] }) {
  const [active, setActive] = useState(boards[0]?.id);
  const current = boards.find((b) => b.id === active) ?? boards[0];

  if (!current) return null;

  return (
    <section
      className="overflow-hidden rounded-panel border border-ink-700 bg-ink-800/50"
      aria-label="Rankings"
    >
      {/*
        * Title and tabs are stacked rather than set side by side. Three tabs
        * and a heading do not both fit across a column this narrow, and what
        * a row gets you is a heading broken across two lines — so the tabs
        * take the full width as a segmented control, which is easier to hit
        * anyway.
        */}
      <header className="border-b border-ink-700 px-4 pb-3 pt-3.5">
        <h2 className="font-display text-title font-bold leading-none text-paper">Top ranked</h2>

        <div role="tablist" aria-label="Ranking" className="mt-3 flex gap-1 rounded-key bg-ink-900/70 p-1">
          {boards.map((b) => (
            <button
              key={b.id}
              role="tab"
              type="button"
              aria-selected={b.id === current.id}
              onClick={() => setActive(b.id)}
              className={`flex-1 rounded-[7px] px-2 py-1.5 text-micro font-semibold uppercase
                          tracking-wide transition-colors ${
                            b.id === current.id
                              ? 'bg-ink-600 text-paper'
                              : 'text-haze hover:text-paper'
                          }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </header>

      <ol className="divide-y divide-ink-700/70">
        {current.items.slice(0, 10).map((anime, i) => {
          const chroma = toChromaVar(anime.coverImage.color);
          const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

          return (
            <li key={anime.id}>
              <Link
                href={`/title/${anime.id}`}
                style={{ ['--chroma' as string]: chroma }}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink-700/50"
              >
                {/* The rank is the reason this list exists, so it is set in
                    the display face and given a fixed column — a wall of
                    numbers that do not line up reads as noise. */}
                <span
                  className={`w-6 shrink-0 text-right font-display text-title font-black tabular-nums
                              ${i < 3 ? 'text-chroma' : 'text-ink-500'}`}
                  aria-hidden
                >
                  {i + 1}
                </span>

                <span className="relative h-[52px] w-[38px] shrink-0 overflow-hidden rounded bg-ink-700">
                  {anime.coverImage.large && (
                    <Image src={anime.coverImage.large} alt="" fill sizes="38px" className="object-cover" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-meta font-semibold text-paper transition-colors group-hover:text-chroma">
                    {displayTitle(anime.title)}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-micro text-haze">
                    {score && (
                      <span className="inline-flex items-center gap-0.5 font-semibold text-gold">
                        <Star size={10} className="fill-current" aria-hidden />
                        {score}
                      </span>
                    )}
                    {anime.format && <span>{anime.format.replace(/_/g, ' ')}</span>}
                    {anime.episodes && <span>{anime.episodes} ep</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
