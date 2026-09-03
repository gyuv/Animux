'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';

/**
 * The top-ten rail. The rank is set enormous in outline behind the poster and
 * clipped by it — the number is the point of the shelf, so it gets the space,
 * while the artwork stays unobscured by the badge that would otherwise sit on
 * top of it.
 */
export function RankCard({ anime, rank }: { anime: Anime; rank: number }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large;

  return (
    <Link
      href={`/title/${anime.id}`}
      style={{ ['--chroma' as string]: chroma }}
      className="group relative flex shrink-0 items-end gap-1 pl-2 outline-none"
      aria-label={`Number ${rank}, ${displayTitle(anime.title)}`}
    >
      <span
        className="select-none font-display text-colossal font-black leading-none
                   text-transparent transition-all duration-300 ease-physical
                   [-webkit-text-stroke:2px_rgb(var(--chroma)/0.55)]
                   group-hover:[-webkit-text-stroke:2px_rgb(var(--chroma))]"
        aria-hidden
      >
        {rank}
      </span>

      <span
        className="relative -ml-6 block aspect-[2/3] w-[126px] shrink-0 overflow-hidden
                   rounded-art bg-ink-800 transition-transform duration-300 ease-physical
                   group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5
                   sm:w-[142px]"
      >
        {src && (
          <Image src={src} alt="" fill sizes="142px" className="object-cover" />
        )}
        <span
          className="pointer-events-none absolute inset-0 rounded-art opacity-0 ring-2 ring-inset
                     transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{
            boxShadow: `0 14px 44px -8px rgb(${chroma} / 0.6)`,
            ['--tw-ring-color' as string]: `rgb(${chroma} / 0.7)`,
          }}
          aria-hidden
        />
      </span>
    </Link>
  );
}
