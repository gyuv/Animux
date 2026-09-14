import Link from 'next/link';
import { Play, Star, ChevronRight } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle, mainStudio } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { airingIn, compact, formatLabel } from '@/lib/format';
import { SmartImage } from '@/components/media/SmartImage';
import { BentoCountdown } from './BentoCountdown';

/**
 * The home "gallery" — an asymmetric bento of what is on now, in the app's own
 * dark material so it sits in line with the rails below it rather than fighting
 * them. One colour per tile, taken from the artwork's own dominant hue
 * (AniList's `coverImage.color`), which the app already extracts.
 *
 * A Server Component (only the live countdown hydrates), so the whole band
 * ships essentially no JavaScript. Every surface is a solid gradient rather
 * than a backdrop-filter, and hover is a transform + shadow — nothing repaints
 * per frame. Each tile owns its aspect-ratio, so nothing collapses at any
 * width; the asymmetry is column spans plus differing ratios. Folds 4→2→1.
 */
export function BentoBoard({ trending, seasonal }: { trending: Anime[]; seasonal: Anime[] }) {
  const pool = dedupe([...trending, ...seasonal]);
  const featured = pool[0];
  if (!featured) return null;

  const airing = pool.find((a) => a.nextAiringEpisode && a.status === 'RELEASING') ?? null;
  const rest = pool.filter((a) => a.id !== featured.id && a.id !== airing?.id);

  return (
    <section aria-label="On now" className="gutter-x py-6">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-micro font-semibold uppercase tracking-[0.22em] text-chroma">On now · curated</p>
          <h2 className="section-title mt-1">The gallery</h2>
        </div>
        <Link
          href="/browse?sort=TRENDING_DESC"
          className="inline-flex items-center gap-1 text-meta text-haze transition-colors hover:text-paper"
        >
          See all <ChevronRight size={15} aria-hidden />
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:[grid-auto-flow:dense]">
        <HeroTile anime={featured} />
        {airing && <CountdownTile anime={airing} />}
        {featured.averageScore ? <ScoreTile score={featured.averageScore} popularity={featured.popularity} /> : null}
        {rest.slice(0, 7).map((a, i) => (
          <PosterTile key={a.id} anime={a} wide={i === 2} />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- shared */

/** Chroma glow + lift on hover, no per-frame work. Applied to every tile. */
const TILE =
  'group relative block overflow-hidden rounded-panel border border-white/[0.06] bg-ink-800 ' +
  'shadow-[0_18px_40px_-30px_rgb(0_0_0/0.9)] outline-none ' +
  'transition-[transform,box-shadow] duration-300 ease-physical ' +
  'hover:-translate-y-1 focus-visible:-translate-y-1 ' +
  'hover:shadow-[0_28px_70px_-28px_rgb(var(--chroma)/0.55)] ' +
  'focus-visible:shadow-[0_28px_70px_-28px_rgb(var(--chroma)/0.55)]';

function tileVars(anime: Anime) {
  return { ['--chroma' as string]: toChromaVar(anime.coverImage.color) };
}

function Scrim() {
  return <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/45 to-transparent" aria-hidden />;
}

function ChromaRing() {
  return (
    <span
      className="pointer-events-none absolute inset-0 rounded-panel opacity-0 ring-1 ring-inset
                 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
      style={{ ['--tw-ring-color' as string]: 'rgb(var(--chroma) / 0.6)' }}
      aria-hidden
    />
  );
}

function Badges({ anime }: { anime: Anime }) {
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const airing = anime.status === 'RELEASING';
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-2">
      {airing && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/70 px-2.5 py-1 text-micro font-bold uppercase tracking-wide text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" /> Airing
        </span>
      )}
      {score && (
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-ink-950/70 px-2.5 py-1 text-micro font-bold text-gold">
          <Star size={11} className="fill-gold text-gold" aria-hidden /> {score}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- hero tile */

function HeroTile({ anime }: { anime: Anime }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large || '';
  const studio = mainStudio(anime);

  return (
    <article className={`${TILE} col-span-2`} style={{ aspectRatio: '16 / 10', ...tileVars(anime) }}>
      {/* Whole-art click-through sits under the buttons. */}
      <Link href={`/title/${anime.id}`} className="absolute inset-0 z-10" aria-label={displayTitle(anime.title)} />
      <SmartImage
        src={src}
        srcLarge={anime.coverImage.extraLarge}
        color={chroma}
        ratio="16 / 10"
        priority
        sizes="(max-width: 1024px) 100vw, 640px"
        className="absolute inset-0 h-full w-full"
        imgClassName="transition-transform duration-700 ease-physical group-hover:scale-[1.04]"
      />
      <Scrim />
      <Badges anime={anime} />
      <div className="absolute inset-x-0 bottom-0 z-20 p-5 sm:p-6">
        {anime.title.native && <p className="text-meta font-medium text-haze">{anime.title.native}</p>}
        <h3 className="mt-0.5 font-display text-[clamp(22px,3.4vw,40px)] font-black leading-none tracking-[-0.02em] text-paper text-balance">
          {displayTitle(anime.title)}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-haze">
          <span>{formatLabel(anime.format)}</span>
          {anime.episodes ? <span>· {anime.episodes} eps</span> : null}
          {studio && <span>· {studio}</span>}
          {anime.popularity ? <span>· {compact(anime.popularity)} watching</span> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href={`/watch/${anime.id}?ep=1`} className="key-chroma relative z-20 !px-4 !py-2.5 text-meta">
            <Play size={15} className="fill-current" aria-hidden /> Play E1
          </Link>
          <Link href={`/title/${anime.id}`} className="key-ghost relative z-20 !px-4 !py-2.5 text-meta">
            Details
          </Link>
        </div>
      </div>
      <ChromaRing />
    </article>
  );
}

/* ---------------------------------------------------------- poster tile */

function PosterTile({ anime, wide }: { anime: Anime; wide: boolean }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large || '';
  const studio = mainStudio(anime);

  return (
    <Link
      href={`/title/${anime.id}`}
      className={`${TILE} ${wide ? 'col-span-2' : 'col-span-1'}`}
      style={{ aspectRatio: wide ? '16 / 10' : '3 / 4', ...tileVars(anime) }}
    >
      <SmartImage
        src={src}
        srcLarge={anime.coverImage.extraLarge}
        color={chroma}
        ratio={wide ? '16 / 10' : '3 / 4'}
        sizes={wide ? '(max-width: 640px) 92vw, 420px' : '(max-width: 640px) 45vw, 220px'}
        className="absolute inset-0 h-full w-full"
        imgClassName="transition-transform duration-700 ease-physical group-hover:scale-[1.05]"
      />
      <Scrim />
      <Badges anime={anime} />
      <div className="absolute inset-x-0 bottom-0 z-20 p-3.5">
        <h3 className={`font-display font-black leading-tight tracking-[-0.01em] text-paper line-clamp-2 ${wide ? 'text-lead' : 'text-meta'}`}>
          {displayTitle(anime.title)}
        </h3>
        {wide && (
          <p className="mt-0.5 text-micro text-haze">
            {formatLabel(anime.format)}{studio ? ` · ${studio}` : ''}
          </p>
        )}
      </div>
      <ChromaRing />
    </Link>
  );
}

/* -------------------------------------------------------- countdown tile */

function CountdownTile({ anime }: { anime: Anime }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large || '';

  return (
    <Link
      href={`/title/${anime.id}`}
      className={`${TILE} col-span-1`}
      style={{ aspectRatio: '3 / 4', ...tileVars(anime) }}
    >
      <SmartImage
        src={src}
        srcLarge={anime.coverImage.extraLarge}
        color={chroma}
        ratio="3 / 4"
        sizes="(max-width: 640px) 45vw, 220px"
        className="absolute inset-0 h-full w-full"
        imgClassName="transition-transform duration-700 ease-physical group-hover:scale-[1.05]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/20" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 z-20 p-3.5">
        <p className="text-micro font-bold uppercase tracking-[0.16em] text-chroma">Next episode in</p>
        <BentoCountdown seconds={anime.nextAiringEpisode?.timeUntilAiring ?? 0} />
        <h3 className="mt-2 line-clamp-1 font-display text-meta font-black text-paper">{displayTitle(anime.title)}</h3>
        <p className="text-micro text-haze">{airingIn(anime.nextAiringEpisode?.timeUntilAiring) ?? 'Airing soon'}</p>
      </div>
      <ChromaRing />
    </Link>
  );
}

/* ------------------------------------------------------------ score tile */

function ScoreTile({ score, popularity }: { score: number; popularity: number | null }) {
  return (
    <div
      className="relative flex flex-col justify-between rounded-panel border border-white/[0.06] p-5"
      style={{
        aspectRatio: '3 / 4',
        background:
          'radial-gradient(120% 120% at 100% 0%, rgb(138 108 255 / 0.22), transparent 60%), #141020',
      }}
    >
      <p className="text-micro font-bold uppercase tracking-[0.2em]" style={{ color: '#a58cff' }}>
        Community score
      </p>
      <div>
        <div className="font-display font-black leading-none tracking-[-0.03em] text-paper" style={{ fontSize: 'clamp(38px,5.5vw,56px)' }}>
          {(score / 10).toFixed(1)}
        </div>
        <p className="mt-1 text-meta text-haze">
          {popularity ? `${compact(popularity)} tracking` : 'Top rated this season'}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- helper */

function dedupe(list: Anime[]): Anime[] {
  const seen = new Set<number>();
  return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}
