'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Play, Check, LayoutGrid, List as ListIcon, Search } from 'lucide-react';
import type { StreamingEpisode } from '@/services/anilist';
import { useLibrary } from '@/store/useLibrary';
import { timecode } from '@/lib/format';

/**
 * Episodes, in whichever of two shapes suits the show.
 *
 * A 12-episode season with artwork and titles from AniList's streaming data
 * deserves cards you can actually look at. A 1000-episode shounen does not —
 * a thousand 16:9 thumbnails is a scroll to nowhere — so it gets the compact
 * list, chunked into ranges, with a jump box. The viewer can override either
 * way; the default just tries to be right first time.
 *
 * Thumbnails come from a dozen different CDNs depending on which service
 * AniList sourced them from, so they use a plain <img> rather than next/image:
 * the optimiser needs every host declared up front, and this set is open-ended.
 */

const CHUNK = 100;
const CARD_LIMIT = 60;

export function EpisodeList({
  animeId,
  total,
  airingNext,
  streamingEpisodes = [],
}: {
  animeId: string;
  total: number | null;
  airingNext: number | null;
  streamingEpisodes?: StreamingEpisode[];
}) {
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState(0);
  const [filter, setFilter] = useState('');
  const progress = useLibrary((s) => s.progress);

  useEffect(() => setMounted(true), []);

  // When a show is still airing, AniList's `episodes` is often null; the
  // next-airing number tells us how many have actually broadcast.
  const count = Math.max(total ?? (airingNext ? airingNext - 1 : 12), 1);

  const [view, setView] = useState<'cards' | 'list'>(() =>
    count <= CARD_LIMIT ? 'cards' : 'list',
  );

  /* AniList's streaming titles arrive as "Episode 7 - The Sword"; the number is
     the only reliable way to line them up with our own numbering. */
  const metaByNumber = useMemo(() => {
    const map = new Map<number, { title: string | null; thumbnail: string | null }>();
    streamingEpisodes.forEach((ep, i) => {
      const match = ep.title?.match(/episode\s+(\d+)/i);
      const n = match ? Number(match[1]) : i + 1;
      if (!map.has(n)) {
        map.set(n, {
          title: ep.title?.replace(/^episode\s+\d+\s*[-–—:]\s*/i, '').trim() || null,
          thumbnail: ep.thumbnail ?? null,
        });
      }
    });
    return map;
  }, [streamingEpisodes]);

  const ranges = useMemo(() => {
    const out: [number, number][] = [];
    for (let start = 1; start <= count; start += CHUNK) {
      out.push([start, Math.min(count, start + CHUNK - 1)]);
    }
    return out;
  }, [count]);

  const [from, to] = ranges[Math.min(range, ranges.length - 1)] ?? [1, count];

  const episodes = useMemo(() => {
    const all = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const term = filter.trim().toLowerCase();
    if (!term) return all;
    return all.filter((ep) => {
      if (String(ep).includes(term)) return true;
      return (metaByNumber.get(ep)?.title ?? '').toLowerCase().includes(term);
    });
  }, [from, to, filter, metaByNumber]);

  const entryFor = (ep: number) =>
    mounted ? progress.find((p) => p.animeId === animeId && p.episode === ep) : undefined;

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-meta text-haze">
          {count} {count === 1 ? 'episode' : 'episodes'}
          {airingNext ? ` · episode ${airingNext} has not aired` : ''}
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search
              size={14}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-haze"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Jump to episode"
              aria-label="Filter episodes"
              className="w-[176px] rounded-key border border-ink-700 bg-ink-800 py-2 pl-8 pr-3
                         text-meta text-paper outline-none placeholder:text-haze/60
                         focus:border-chroma"
            />
          </label>

          {ranges.length > 1 && (
            <select
              value={Math.min(range, ranges.length - 1)}
              onChange={(e) => setRange(Number(e.target.value))}
              aria-label="Episode range"
              className="rounded-key border border-ink-700 bg-ink-800 px-3 py-2 text-meta text-paper"
            >
              {ranges.map(([a, b], i) => (
                <option key={a} value={i}>{a}–{b}</option>
              ))}
            </select>
          )}

          <div className="flex overflow-hidden rounded-key border border-ink-700">
            <ViewToggle on={view === 'cards'} onClick={() => setView('cards')} label="Card view">
              <LayoutGrid size={15} aria-hidden />
            </ViewToggle>
            <ViewToggle on={view === 'list'} onClick={() => setView('list')} label="List view">
              <ListIcon size={15} aria-hidden />
            </ViewToggle>
          </div>
        </div>
      </div>

      {episodes.length === 0 ? (
        <p className="text-meta text-haze">No episode matches “{filter.trim()}”.</p>
      ) : view === 'cards' ? (
        <ul className="grid gap-x-3 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
          {episodes.map((ep) => (
            <li key={ep}>
              <EpisodeCard
                animeId={animeId}
                ep={ep}
                meta={metaByNumber.get(ep)}
                entry={entryFor(ep)}
                unaired={Boolean(airingNext && ep >= airingNext)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
          {episodes.map((ep) => (
            <li key={ep}>
              <EpisodeRow
                animeId={animeId}
                ep={ep}
                meta={metaByNumber.get(ep)}
                entry={entryFor(ep)}
                unaired={Boolean(airingNext && ep >= airingNext)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- bits */

type Entry = { position: number; duration: number } | undefined;
type Meta = { title: string | null; thumbnail: string | null } | undefined;

const ratio = (entry: Entry) =>
  entry && entry.duration > 0 ? (entry.position / entry.duration) * 100 : 0;

function href(animeId: string, ep: number, entry: Entry, done: boolean) {
  const resume = entry && !done ? `&t=${Math.floor(entry.position)}` : '';
  return `/watch/${animeId}?ep=${ep}${resume}`;
}

function EpisodeCard({
  animeId, ep, meta, entry, unaired,
}: { animeId: string; ep: number; meta: Meta; entry: Entry; unaired: boolean }) {
  const pct = ratio(entry);
  const done = pct >= 92;

  const body = (
    <>
      <span className="relative block aspect-video overflow-hidden rounded-art bg-ink-800">
        {meta?.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={meta.thumbnail}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-physical
                       group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid h-full w-full place-items-center font-display text-title font-black text-ink-600">
            {ep}
          </span>
        )}

        {!unaired && (
          <span className="absolute inset-0 grid place-items-center bg-ink-950/45 opacity-0
                           transition-opacity duration-200 group-hover:opacity-100
                           group-focus-visible:opacity-100">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-chroma text-ink-900">
              {done ? <Check size={19} aria-hidden /> : <Play size={19} className="ml-0.5 fill-current" aria-hidden />}
            </span>
          </span>
        )}

        {pct > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-950/70">
            <span className="block h-full bg-chroma" style={{ width: `${Math.min(100, pct)}%` }} />
          </span>
        )}
      </span>

      <span className="mt-2.5 block">
        <span className="flex items-baseline gap-2">
          <span className="text-micro font-semibold uppercase tracking-wide text-chroma">
            Ep {ep}
          </span>
          {done && <span className="text-micro text-haze/70">Watched</span>}
          {!done && entry && (
            <span className="text-micro text-haze/70">{timecode(entry.position)} in</span>
          )}
          {unaired && <span className="text-micro text-haze/70">Not aired</span>}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-meta font-medium leading-snug text-paper">
          {meta?.title ?? `Episode ${ep}`}
        </span>
      </span>
    </>
  );

  if (unaired) return <div className="block opacity-45">{body}</div>;

  return (
    <Link href={href(animeId, ep, entry, done)} className="group block outline-none">
      {body}
    </Link>
  );
}

function EpisodeRow({
  animeId, ep, meta, entry, unaired,
}: { animeId: string; ep: number; meta: Meta; entry: Entry; unaired: boolean }) {
  const pct = ratio(entry);
  const done = pct >= 92;

  const body = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-paper
                       transition-colors group-hover:bg-chroma group-hover:text-ink-900">
        {done ? <Check size={15} aria-hidden /> : <Play size={14} className="ml-0.5 fill-current" aria-hidden />}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-meta font-semibold text-paper">
          {meta?.title ? `${ep}. ${meta.title}` : `Episode ${ep}`}
        </span>
        {!done && entry && (
          <span className="block text-micro text-haze">{timecode(entry.position)} watched</span>
        )}
        {done && <span className="block text-micro text-haze">Watched</span>}
        {unaired && <span className="block text-micro text-haze">Not aired</span>}
      </span>

      {pct > 0 && !done && (
        <span className="absolute inset-x-0 bottom-0 h-[2px] bg-ink-900">
          <span className="block h-full bg-chroma" style={{ width: `${pct}%` }} />
        </span>
      )}
    </>
  );

  const shell =
    'group relative flex items-center gap-3 overflow-hidden rounded-key border border-ink-700 bg-ink-800 px-3.5 py-3';

  if (unaired) return <div className={`${shell} opacity-45`}>{body}</div>;

  return (
    <Link
      href={href(animeId, ep, entry, done)}
      className={`${shell} transition-colors duration-150 hover:border-chroma`}
    >
      {body}
    </Link>
  );
}

function ViewToggle({
  on, onClick, label, children,
}: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`px-2.5 py-2 transition-colors ${on ? 'bg-ink-700 text-paper' : 'bg-ink-800 text-haze hover:text-paper'}`}
    >
      {children}
    </button>
  );
}
