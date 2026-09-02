'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Play, Check } from 'lucide-react';
import { useLibrary } from '@/store/useLibrary';
import { timecode } from '@/lib/format';

/**
 * Long-running shows break the page if every episode is a card, so anything
 * over 50 gets chunked into ranges the viewer picks from. Progress comes from
 * local state, which means it renders after mount and never on the server.
 */

const CHUNK = 50;

export function EpisodeList({
  animeId,
  total,
  airingNext,
}: {
  animeId: string;
  total: number | null;
  airingNext: number | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState(0);
  const progress = useLibrary((s) => s.progress);

  useEffect(() => setMounted(true), []);

  // When a show is still airing, AniList's `episodes` is often null; the
  // next-airing number tells us how many have actually broadcast.
  const count = total ?? (airingNext ? airingNext - 1 : 12);

  const ranges = useMemo(() => {
    const out: [number, number][] = [];
    for (let start = 1; start <= count; start += CHUNK) {
      out.push([start, Math.min(count, start + CHUNK - 1)]);
    }
    return out;
  }, [count]);

  const [from, to] = ranges[range] ?? [1, count];
  const episodes = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  const watchedFor = (ep: number) =>
    mounted ? progress.find((p) => p.animeId === animeId && p.episode === ep) : undefined;

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-title font-bold text-paper">Episodes</h2>
        {ranges.length > 1 && (
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            aria-label="Episode range"
            className="rounded-key border border-ink-700 bg-ink-800 px-3 py-2 text-meta text-paper"
          >
            {ranges.map(([a, b], i) => (
              <option key={a} value={i}>{a}–{b}</option>
            ))}
          </select>
        )}
      </div>

      <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
        {episodes.map((ep) => {
          const entry = watchedFor(ep);
          const pct = entry && entry.duration > 0 ? (entry.position / entry.duration) * 100 : 0;
          const done = pct >= 92;

          return (
            <li key={ep}>
              <Link
                href={`/watch/${animeId}?ep=${ep}${entry && !done ? `&t=${Math.floor(entry.position)}` : ''}`}
                className="group relative flex items-center gap-3 overflow-hidden rounded-key
                           border border-ink-700 bg-ink-800 px-3.5 py-3 transition-colors
                           duration-150 hover:border-chroma"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full
                                 bg-ink-700 text-paper transition-colors group-hover:bg-chroma
                                 group-hover:text-ink-900">
                  {done ? <Check size={15} aria-hidden /> : <Play size={14} className="ml-0.5 fill-current" aria-hidden />}
                </span>

                <span className="min-w-0">
                  <span className="block text-meta font-semibold text-paper">Episode {ep}</span>
                  {entry && !done && (
                    <span className="block text-micro text-haze">
                      {timecode(entry.position)} watched
                    </span>
                  )}
                  {done && <span className="block text-micro text-haze">Watched</span>}
                </span>

                {pct > 0 && !done && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] bg-ink-900">
                    <span className="block h-full bg-chroma" style={{ width: `${pct}%` }} />
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {airingNext && (
        <p className="mt-4 text-meta text-haze">
          Episode {airingNext} has not aired yet.
        </p>
      )}
    </section>
  );
}
