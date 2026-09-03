'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { countdown } from '@/lib/format';

/**
 * Broadcasts inside the next two days, counting down live.
 *
 * The countdown ticks client-side from the server's `timeUntilAiring`, taken
 * once at render. Recomputing from `airingAt` against the viewer's clock would
 * be wrong for anyone whose device time is off; drifting a second per minute
 * against the server is not.
 */
export function AiringStrip({ items }: { items: Anime[] }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="py-6" aria-label="Airing soon">
      <header className="gutter-x mb-3.5 flex items-end justify-between gap-4">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Radio size={18} className="text-signal" aria-hidden />
            On air soon
          </h2>
          <p className="mt-0.5 text-meta text-haze">Broadcasting in the next 48 hours</p>
        </div>
        <Link href="/schedule" className="text-meta text-haze transition-colors hover:text-paper">
          Full schedule
        </Link>
      </header>

      <div className="rail-scroll gutter-x pb-2">
        {items.map((anime) => {
          const left = (anime.nextAiringEpisode?.timeUntilAiring ?? 0) - elapsed;
          const chroma = toChromaVar(anime.coverImage.color);

          return (
            <Link
              key={anime.id}
              href={`/title/${anime.id}`}
              style={{ ['--chroma' as string]: chroma }}
              className="group flex w-[260px] shrink-0 items-center gap-3 rounded-panel
                         border border-ink-700 bg-ink-800/70 p-2.5 pr-4 transition-all
                         duration-200 ease-physical hover:border-chroma/60 hover:bg-ink-700/70"
            >
              <span className="relative h-[62px] w-[44px] shrink-0 overflow-hidden rounded bg-ink-700">
                {anime.coverImage.large && (
                  <Image src={anime.coverImage.large} alt="" fill sizes="44px" className="object-cover" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-meta font-semibold text-paper">
                  {displayTitle(anime.title)}
                </span>
                <span className="mt-0.5 block text-micro text-haze">
                  Episode {anime.nextAiringEpisode?.episode}
                </span>
                <span className="mt-1 block text-micro font-semibold tabular-nums text-chroma">
                  {left > 0 ? `in ${countdown(left)}` : 'airing now'}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
