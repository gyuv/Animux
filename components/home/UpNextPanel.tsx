'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Radio, ArrowRight } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { countdown } from '@/lib/format';

/**
 * What broadcasts next, counting down.
 *
 * Deliberately a countdown rather than a weekday grid. A grid has to name a
 * day and a clock time, which means picking a timezone: the server's is wrong
 * for most viewers, and the viewer's cannot be known while rendering on the
 * server without the markup disagreeing with itself on arrival. A countdown is
 * the same number everywhere, and is the number someone actually wants.
 *
 * It ticks from the server's `timeUntilAiring`, read once, rather than from
 * the viewer's clock — a device with the wrong time still gets a right answer,
 * and first paint matches what the server sent.
 */
export function UpNextPanel({ items }: { items: Anime[] }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  if (items.length === 0) return null;

  return (
    <section
      className="overflow-hidden rounded-panel border border-ink-700 bg-ink-800/50"
      aria-label="Airing next"
    >
      <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-title font-bold text-paper">
          <Radio size={16} className="text-signal" aria-hidden />
          Airing next
        </h2>
        <Link
          href="/schedule"
          className="group inline-flex items-center gap-1 text-micro text-haze transition-colors hover:text-paper"
        >
          Week
          <ArrowRight size={12} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </header>

      <ul className="divide-y divide-ink-700/70">
        {items.slice(0, 8).map((anime) => {
          const left = (anime.nextAiringEpisode?.timeUntilAiring ?? 0) - elapsed;
          const chroma = toChromaVar(anime.coverImage.color);

          return (
            <li key={anime.id}>
              <Link
                href={`/title/${anime.id}`}
                style={{ ['--chroma' as string]: chroma }}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink-700/50"
              >
                <span className="relative h-[46px] w-[34px] shrink-0 overflow-hidden rounded bg-ink-700">
                  {anime.coverImage.large && (
                    <Image src={anime.coverImage.large} alt="" fill sizes="34px" className="object-cover" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-meta font-semibold text-paper transition-colors group-hover:text-chroma">
                    {displayTitle(anime.title)}
                  </span>
                  <span className="mt-0.5 block text-micro text-haze">
                    Episode {anime.nextAiringEpisode?.episode}
                  </span>
                </span>

                <span
                  className={`shrink-0 text-micro font-semibold tabular-nums ${
                    left > 0 ? 'text-chroma' : 'animate-pulseSignal text-signal'
                  }`}
                >
                  {left > 0 ? countdown(left) : 'now'}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
