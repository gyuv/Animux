'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Play, Plus, Check } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { stripHtml, airingIn, season } from '@/lib/format';
import { useLibrary } from '@/store/useLibrary';

/**
 * The hero opens on the artwork, full bleed, with the title set large in the
 * display face and the native title sitting directly beneath it at a quarter
 * of the size. That pairing is the one piece of typographic staging on the
 * page — it belongs to this subject and nothing else, and it earns its place
 * because both titles are real information a viewer searches by.
 */
export function Hero({ anime }: { anime: Anime }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const backdrop = anime.bannerImage || anime.coverImage.extraLarge;
  const synopsis = stripHtml(anime.description);
  const next = airingIn(anime.nextAiringEpisode?.timeUntilAiring);
  const studio = anime.studios?.nodes?.[0]?.name;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  const saved = useLibrary((s) => s.saved.includes(String(anime.id)));
  const toggleSaved = useLibrary((s) => s.toggleSaved);

  return (
    <section
      style={{ ['--chroma' as string]: chroma }}
      className="relative isolate min-h-[74svh] w-full overflow-hidden sm:min-h-[68svh]"
    >
      {backdrop && (
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
      )}

      {/* Ink floor, then a wash of the artwork's own colour rising from the left. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/10" />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(105deg, rgb(var(--chroma) / 0.30) 0%, rgb(var(--chroma) / 0.06) 38%, transparent 62%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink-900 to-transparent" />

      <div className="gutter-x relative flex min-h-[74svh] flex-col justify-end pb-10 pt-24 sm:min-h-[68svh] sm:pb-14">
        <div className="max-w-[46ch]">
          {next && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-signal/30
                          bg-signal/10 px-3 py-1 text-micro font-medium text-signal">
              <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" aria-hidden />
              {next}
            </p>
          )}

          <h1 className="font-display text-hero font-black text-paper sm:text-mega">
            {displayTitle(anime.title)}
          </h1>

          {anime.title.native && (
            <p className="mt-1.5 font-display text-lead font-bold text-haze/80">
              {anime.title.native}
            </p>
          )}

          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-haze">
            {score && <span className="font-semibold text-paper">{score}</span>}
            {season(anime.season, anime.seasonYear) && <span>{season(anime.season, anime.seasonYear)}</span>}
            {anime.episodes && <span>{anime.episodes} episodes</span>}
            {studio && <span>{studio}</span>}
          </p>

          {synopsis && (
            <p className="mt-4 line-clamp-3 max-w-[52ch] text-body text-haze">{synopsis}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={`/watch/${anime.id}?ep=1`} className="key-primary">
              <Play size={17} className="fill-ink-900" aria-hidden />
              Play episode 1
            </Link>
            <Link href={`/title/${anime.id}`} className="key-ghost">
              Episodes and details
            </Link>
            <button
              type="button"
              onClick={() => toggleSaved(String(anime.id))}
              aria-pressed={saved}
              className="key-ghost"
            >
              {saved ? <Check size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative min-h-[74svh] sm:min-h-[68svh]" aria-hidden>
      <div className="skeleton absolute inset-0" />
      <div className="gutter-x relative flex min-h-[74svh] flex-col justify-end pb-14 sm:min-h-[68svh]">
        <div className="skeleton h-12 w-[min(90%,460px)] rounded" />
        <div className="skeleton mt-4 h-4 w-[min(70%,320px)] rounded" />
        <div className="skeleton mt-5 h-11 w-56 rounded-key" />
      </div>
    </div>
  );
}
