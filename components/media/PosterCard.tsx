'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';

/**
 * At rest the card is only artwork and two lines of type — no badges, no
 * gradient scrim, no hover buttons layered over someone's key art. The
 * colour arrives on focus, drawn from the poster itself, so a wall of
 * cards reads as a wall of paintings until you point at one.
 */

interface Props {
  anime: Anime;
  /** Fraction watched, 0–1, drawn as a hairline under the art. */
  progress?: number;
  priority?: boolean;
  sizes?: string;
}

export function PosterCard({ anime, progress, priority, sizes }: Props) {
  const [loaded, setLoaded] = useState(false);
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large;
  const airing = anime.status === 'RELEASING';
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  return (
    <Link
      href={`/title/${anime.id}`}
      style={{ ['--chroma' as string]: chroma }}
      className="group relative block w-[144px] shrink-0 outline-none
                 sm:w-[164px] [--card-w:144px] sm:[--card-w:164px]"
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
            sizes={sizes ?? '(max-width: 640px) 45vw, 180px'}
            priority={priority}
            onLoad={() => setLoaded(true)}
            className={`object-cover transition-opacity duration-500
                        ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!loaded && <div className="skeleton absolute inset-0" aria-hidden />}

        {/* Chroma edge — the card's own colour, only once you're on it. */}
        <div
          className="pointer-events-none absolute inset-0 rounded-art opacity-0
                     ring-2 ring-inset transition-opacity duration-300
                     group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{ boxShadow: `0 12px 40px -8px rgb(${chroma} / 0.55)`, ['--tw-ring-color' as string]: `rgb(${chroma} / 0.7)` }}
          aria-hidden
        />

        {progress !== undefined && progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-900/70">
            <div
              className="h-full bg-chroma"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-2 text-meta font-semibold leading-snug text-paper
                       transition-colors group-hover:text-chroma group-focus-visible:text-chroma">
          {displayTitle(anime.title)}
        </h3>
        <p className="mt-1 flex items-center gap-2 text-micro text-haze">
          {airing && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" aria-hidden />
              Airing
            </span>
          )}
          {!airing && anime.episodes ? <span>{anime.episodes} episodes</span> : null}
          {score && <span className="text-haze/70">{score}</span>}
        </p>
      </div>
    </Link>
  );
}

export function PosterSkeleton() {
  return (
    <div className="w-[144px] shrink-0 sm:w-[164px]" aria-hidden>
      <div className="skeleton aspect-[2/3] rounded-art" />
      <div className="skeleton mt-2.5 h-3.5 w-4/5 rounded" />
      <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
    </div>
  );
}
