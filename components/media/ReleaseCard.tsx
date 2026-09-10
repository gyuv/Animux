'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Star, Play } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';

/**
 * The grid card, for the shelf where the episode number is the news.
 *
 * A deliberate departure from PosterCard, which stays bare on purpose — a
 * wall of rails reads best as a wall of paintings. This grid is answering a
 * different question ("what is out that I have not seen"), and the answer is
 * a number, so the badges earn their place here and nowhere else.
 *
 * Every badge is a fact the catalogue actually holds. Nothing is inferred to
 * fill a slot, so a card with no score simply has no score chip rather than a
 * zero or a dash.
 */

interface Props {
  anime: Anime;
  /** The most recent episode out, when it is known. */
  episodeOut?: number | null;
  priority?: boolean;
}

export function ReleaseCard({ anime, episodeOut, priority }: Props) {
  const [loaded, setLoaded] = useState(false);
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  return (
    <Link
      href={`/title/${anime.id}`}
      style={{ ['--chroma' as string]: chroma }}
      className="group relative block outline-none"
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-art bg-ink-800
                   transition-transform duration-300 ease-physical
                   group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5"
      >
        {src && (
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 22vw, 180px"
            priority={priority}
            onLoad={() => setLoaded(true)}
            className={`object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!loaded && <div className="skeleton absolute inset-0" aria-hidden />}

        {/* Scrim only under the badges, so the art stays unobscured above it. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16
                     bg-gradient-to-b from-black/65 to-transparent"
          aria-hidden
        />

        <div className="pointer-events-none absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1">
          {score ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5
                             text-micro font-bold text-gold backdrop-blur-sm">
              <Star size={9} className="fill-current" aria-hidden />
              {score}
            </span>
          ) : <span />}

          {episodeOut ? (
            <span className="rounded bg-chroma/85 px-1.5 py-0.5 text-micro font-bold text-ink-950">
              EP {episodeOut}
            </span>
          ) : null}
        </div>

        {/* Play affordance on pointer devices — the grid is a launcher. */}
        <div
          className="pointer-events-none absolute inset-0 grid place-items-center opacity-0
                     transition-opacity duration-200 group-hover:opacity-100
                     group-focus-visible:opacity-100"
          aria-hidden
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-paper/95 text-ink-950 shadow-lg">
            <Play size={18} className="ml-0.5 fill-current" />
          </span>
        </div>

        <div
          className="pointer-events-none absolute inset-0 rounded-art opacity-0 ring-2 ring-inset
                     transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{
            boxShadow: `0 14px 44px -10px rgb(${chroma} / 0.6)`,
            ['--tw-ring-color' as string]: `rgb(${chroma} / 0.7)`,
          }}
          aria-hidden
        />
      </div>

      <h3 className="mt-2 line-clamp-2 text-meta font-semibold leading-snug text-paper
                     transition-colors group-hover:text-chroma group-focus-visible:text-chroma">
        {displayTitle(anime.title)}
      </h3>
      <p className="mt-0.5 flex items-center gap-1.5 text-micro text-haze">
        {anime.format && <span>{anime.format.replace(/_/g, ' ')}</span>}
        {anime.format && anime.duration ? <span aria-hidden>·</span> : null}
        {anime.duration ? <span>{anime.duration}m</span> : null}
      </p>
    </Link>
  );
}
