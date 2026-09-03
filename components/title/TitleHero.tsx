'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Play, Film, Star, Plus, Check, RotateCcw } from 'lucide-react';
import type { AnimeDetail } from '@/services/anilist';
import { displayTitle, mainStudio } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { airingIn, formatLabel, season, statusLabel, timecode } from '@/lib/format';
import { useLibrary } from '@/store/useLibrary';
import { TrailerModal, trailerUrl } from '@/components/media/TrailerModal';

/**
 * The top of a title page has one job: get the viewer into the right episode
 * in one click. If they have watched some of it, that click resumes where they
 * stopped; if not, it starts at episode one. Everything else on this page is
 * reference material, and it can wait below the fold.
 */
export function TitleHero({ anime }: { anime: AnimeDetail }) {
  const [trailer, setTrailer] = useState(false);

  const chroma = toChromaVar(anime.coverImage.color);
  const backdrop = anime.bannerImage || anime.coverImage.extraLarge;
  const next = airingIn(anime.nextAiringEpisode?.timeUntilAiring);
  const studio = mainStudio(anime);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const hasTrailer = Boolean(trailerUrl(anime.trailer));
  const id = String(anime.id);

  const saved = useLibrary((s) => s.saved.includes(id));
  const toggleSaved = useLibrary((s) => s.toggleSaved);
  // Zustand hydrates from localStorage after mount, so this is intentionally
  // undefined on the server and on the first paint — see `hydrated` below.
  const hydrated = useLibrary((s) => s.hydrated);
  const resume = useLibrary((s) =>
    s.progress
      .filter((p) => p.animeId === id)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0],
  );

  const showResume = hydrated && resume && resume.duration > 0;

  return (
    <div style={{ ['--chroma' as string]: chroma }}>
      {/* Backdrop, held short so the artwork frames the page without owning it. */}
      <div className="relative h-[42svh] min-h-[260px] w-full sm:h-[50svh]">
        {backdrop && (
          <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover object-top" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/55 to-ink-900/20" />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, rgb(${chroma} / 0.26), transparent 58%)` }}
        />
      </div>

      {/* Positioned so it paints above the backdrop it overlaps — the backdrop
          is itself positioned, and without this its bottom gradient covers the
          first row of metadata. */}
      <div className="gutter-x relative z-10 -mt-28 sm:-mt-36">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <div
            className="relative aspect-[2/3] w-[136px] shrink-0 overflow-hidden rounded-art bg-ink-800 sm:w-[204px]"
            style={{ boxShadow: `0 30px 80px -22px rgb(${chroma} / 0.55)` }}
          >
            {anime.coverImage.extraLarge && (
              <Image src={anime.coverImage.extraLarge} alt="" fill sizes="204px" priority className="object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1 sm:pt-28">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="chip border-white/10 bg-white/[0.06] text-paper">
                {formatLabel(anime.format)}
              </span>
              <span className="chip">{statusLabel(anime.status)}</span>
              {season(anime.season, anime.seasonYear) && (
                <span className="chip">{season(anime.season, anime.seasonYear)}</span>
              )}
              {score && (
                <span className="chip">
                  <Star size={12} className="fill-gold text-gold" aria-hidden />
                  {score}
                </span>
              )}
            </div>

            <h1 className="text-balance font-display text-hero font-black leading-none text-paper">
              {displayTitle(anime.title)}
            </h1>
            {anime.title.native && (
              <p className="mt-2 font-display text-lead font-bold text-haze/75">{anime.title.native}</p>
            )}

            {studio && <p className="mt-2 text-meta text-haze">{studio}</p>}

            {next && (
              <p className="mt-3 inline-flex items-center gap-2 text-meta font-medium text-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" aria-hidden />
                {next}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {showResume ? (
                <Link
                  href={`/watch/${anime.id}?ep=${resume.episode}&t=${Math.floor(resume.position)}`}
                  className="key-chroma"
                >
                  <RotateCcw size={16} aria-hidden />
                  Resume episode {resume.episode} · {timecode(resume.position)}
                </Link>
              ) : (
                <Link href={`/watch/${anime.id}?ep=1`} className="key-chroma">
                  <Play size={17} className="fill-current" aria-hidden />
                  Play episode 1
                </Link>
              )}

              {hasTrailer && (
                <button type="button" onClick={() => setTrailer(true)} className="key-ghost">
                  <Film size={16} aria-hidden />
                  Trailer
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleSaved(id)}
                aria-pressed={saved}
                className="key-ghost"
              >
                {saved ? <Check size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
                {saved ? 'In your library' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <TrailerModal
        trailer={anime.trailer}
        title={displayTitle(anime.title)}
        open={trailer}
        onClose={() => setTrailer(false)}
      />
    </div>
  );
}
