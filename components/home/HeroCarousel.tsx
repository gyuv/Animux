'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Plus, Check, Info, Film, Star } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle, mainStudio } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { stripHtml, airingIn, season, formatLabel, compact } from '@/lib/format';
import { useLibrary } from '@/store/useLibrary';
import { useChroma } from '@/hooks/useChroma';
import { TrailerModal, trailerUrl } from '@/components/media/TrailerModal';

/**
 * The front door. Five titles, one at a time, advancing on a nine-second timer
 * that stops the moment the viewer touches anything — hovering, focusing a
 * button, or switching to another tab. An auto-carousel that keeps moving
 * while you are reading it is the most reliably irritating pattern on the web,
 * and the fix costs three event listeners.
 *
 * The whole page tints to the artwork of whichever slide is showing, so the
 * transition is not just a crossfade of two images but a repaint of the shell
 * around them.
 */

const INTERVAL_MS = 9000;

export function HeroCarousel({ items }: { items: Anime[] }) {
  const slides = items.slice(0, 5);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trailer, setTrailer] = useState(false);
  const startedAt = useRef(Date.now());

  const current = slides[index];
  useChroma(current?.coverImage.color);

  const advance = useCallback(
    (step: number) => {
      setIndex((i) => (i + step + slides.length) % slides.length);
      startedAt.current = Date.now();
    },
    [slides.length],
  );

  useEffect(() => {
    if (paused || trailer || slides.length < 2) return;
    const timer = setInterval(() => advance(1), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, trailer, advance, slides.length]);

  // A carousel ticking over in a background tab wastes battery and, worse,
  // means the viewer returns to a slide they never saw start.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!current) return null;

  return (
    <section
      aria-label="Featured"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="relative isolate min-h-[84svh] w-full overflow-hidden sm:min-h-[78svh]"
    >
      {slides.map((anime, i) => (
        <Backdrop key={anime.id} anime={anime} active={i === index} priority={i === 0} />
      ))}

      <div className="gutter-x relative flex min-h-[84svh] flex-col justify-end pb-12 pt-24 sm:min-h-[78svh] sm:pb-16">
        <Copy key={current.id} anime={current} onTrailer={() => setTrailer(true)} />

        {slides.length > 1 && (
          <Ticks
            slides={slides}
            index={index}
            paused={paused || trailer}
            onPick={(i) => { setIndex(i); startedAt.current = Date.now(); }}
          />
        )}
      </div>

      <TrailerModal
        trailer={current.trailer}
        title={displayTitle(current.title)}
        open={trailer}
        onClose={() => setTrailer(false)}
      />
    </section>
  );
}

/* --------------------------------------------------------------- backdrop */

function Backdrop({ anime, active, priority }: { anime: Anime; active: boolean; priority: boolean }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.bannerImage || anime.coverImage.extraLarge;

  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 transition-opacity duration-[900ms] ease-physical
                  ${active ? 'opacity-100' : 'opacity-0'}`}
    >
      {src && (
        <Image
          src={src}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className={`object-cover object-top ${active ? 'animate-drift' : ''}`}
        />
      )}
      {/* Ink floor, then a wash of the artwork's own colour rising from the left. */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/72 to-ink-900/10" />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(100deg, rgb(${chroma} / 0.34) 0%, rgb(${chroma} / 0.07) 40%, transparent 65%)`,
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink-900 to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------- copy */

function Copy({ anime, onTrailer }: { anime: Anime; onTrailer: () => void }) {
  const synopsis = stripHtml(anime.description);
  const next = airingIn(anime.nextAiringEpisode?.timeUntilAiring);
  const studio = mainStudio(anime);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const hasTrailer = Boolean(trailerUrl(anime.trailer));

  const saved = useLibrary((s) => s.saved.includes(String(anime.id)));
  const toggleSaved = useLibrary((s) => s.toggleSaved);

  return (
    <div className="max-w-[48ch] animate-rise">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="chip border-white/10 bg-white/[0.06] text-paper">
          {formatLabel(anime.format)}
        </span>
        {next && (
          <span className="inline-flex items-center gap-2 rounded-full border border-signal/30
                           bg-signal/10 px-3 py-1.5 text-micro font-medium text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" aria-hidden />
            {next}
          </span>
        )}
      </div>

      <h1 className="text-balance font-display text-hero font-black text-paper sm:text-mega">
        {displayTitle(anime.title)}
      </h1>

      {anime.title.native && (
        <p className="mt-2 font-display text-lead font-bold text-haze/75">{anime.title.native}</p>
      )}

      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-haze">
        {score && (
          <span className="inline-flex items-center gap-1 font-semibold text-paper">
            <Star size={13} className="fill-gold text-gold" aria-hidden />
            {score}
          </span>
        )}
        {season(anime.season, anime.seasonYear) && <span>{season(anime.season, anime.seasonYear)}</span>}
        {anime.episodes ? <span>{anime.episodes} episodes</span> : null}
        {studio && <span>{studio}</span>}
        {anime.popularity ? <span>{compact(anime.popularity)} watching</span> : null}
      </p>

      {synopsis && (
        <p className="mt-4 line-clamp-3 max-w-[54ch] text-body text-haze">{synopsis}</p>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href={`/watch/${anime.id}?ep=1`} className="key-chroma">
          <Play size={17} className="fill-current" aria-hidden />
          Play episode 1
        </Link>
        <Link href={`/title/${anime.id}`} className="key-ghost">
          <Info size={16} aria-hidden />
          Details
        </Link>
        {hasTrailer && (
          <button type="button" onClick={onTrailer} className="key-ghost">
            <Film size={16} aria-hidden />
            Trailer
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleSaved(String(anime.id))}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from library' : 'Save to library'}
          className="key-ghost px-3.5"
        >
          {saved ? <Check size={17} aria-hidden /> : <Plus size={17} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ticks */

/**
 * Progress ticks rather than dots: each one fills over the dwell time, so the
 * viewer can see the slide is about to change instead of being surprised by it.
 */
function Ticks({
  slides,
  index,
  paused,
  onPick,
}: {
  slides: Anime[];
  index: number;
  paused: boolean;
  onPick: (i: number) => void;
}) {
  return (
    <div className="mt-9 flex items-center gap-2.5">
      {slides.map((anime, i) => (
        <button
          key={anime.id}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`Show ${displayTitle(anime.title)}`}
          aria-current={i === index}
          className="group h-6 w-10 shrink-0"
        >
          <span className="block h-[3px] w-full overflow-hidden rounded-full bg-white/20
                           transition-transform duration-200 group-hover:scale-y-[2]">
            <span
              className={`block h-full rounded-full bg-chroma ${i === index ? 'origin-left' : ''}`}
              style={
                i === index
                  ? {
                      animation: `tick ${INTERVAL_MS}ms linear forwards`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }
                  : { width: i < index ? '100%' : '0%', opacity: i < index ? 0.4 : 0 }
              }
            />
          </span>
        </button>
      ))}

      <style>{`@keyframes tick { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
