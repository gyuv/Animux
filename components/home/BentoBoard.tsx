'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Play, Star, Plus, ChevronRight } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle, mainStudio } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { airingIn, compact, formatLabel } from '@/lib/format';
import { SmartImage } from '@/components/media/SmartImage';

/**
 * The home "gallery" — a light, asymmetric bento sat inside the app's dark
 * chrome, the way a bright print gallery hangs off a dark corridor.
 *
 * Deliberately light where the rest of Animux is dark: porcelain ground, white
 * tiles, soft layered shadows, ink text. The one colour on each tile is the
 * artwork's own dominant hue (AniList's `coverImage.color`), which the app
 * already extracts — so the accent follows the art rather than a fixed brand
 * colour, and reads cleanly on the pale ground.
 *
 * Layout is a four-column composition on desktop that folds to two and then
 * one as the viewport narrows; the app's density system already scales type
 * and focus rings up for the TV form factor, so the same tiles serve all three.
 */

const INK = '#1A1523';
const MUTED = '#6B6478';

export function BentoBoard({ trending, seasonal }: { trending: Anime[]; seasonal: Anime[] }) {
  const pool = dedupe([...trending, ...seasonal]);
  const featured = pool[0];
  if (!featured) return null;

  const airing = pool.find((a) => a.nextAiringEpisode && a.status === 'RELEASING') ?? null;
  const rest = pool.filter((a) => a.id !== featured.id && a.id !== airing?.id);

  return (
    <section
      aria-label="On now"
      className="gutter-x relative py-8"
    >
      <div
        className="relative overflow-hidden rounded-[30px] p-4 sm:p-6"
        style={{
          background:
            'radial-gradient(90% 120% at 12% 0%, #FBFAFE 0%, #F1ECF7 55%, #E9E3F2 100%)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.7) inset, 0 40px 120px -50px rgba(18,10,40,0.65)',
        }}
      >
        <header className="mb-5 flex items-end justify-between gap-4 px-1">
          <div>
            <p
              className="font-mono text-micro font-semibold uppercase tracking-[0.24em]"
              style={{ color: '#8A5CF6' }}
            >
              On now · curated
            </p>
            <h2
              className="mt-1.5 font-display text-title font-black tracking-[-0.02em]"
              style={{ color: INK }}
            >
              The gallery
            </h2>
          </div>
          <Link
            href="/browse?sort=TRENDING_DESC"
            className="inline-flex items-center gap-1 rounded-full border px-3.5 py-2 text-meta font-semibold transition-colors"
            style={{ color: INK, borderColor: 'rgba(26,21,35,0.14)' }}
          >
            See all <ChevronRight size={15} aria-hidden />
          </Link>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:[grid-auto-flow:dense]">
          {/* Featured — wide cinematic tile */}
          <Tile anime={featured} className="col-span-2" aspect="16 / 10" size="hero" priority />

          {/* Live countdown — portrait */}
          {airing && <CountdownTile anime={airing} className="col-span-1" />}

          {/* Score stat — portrait */}
          {featured.averageScore && (
            <ScoreTile score={featured.averageScore} popularity={featured.popularity} />
          )}

          {/* Standard poster tiles + a wide one, interleaved for rhythm */}
          {rest.slice(0, 7).map((a, i) => (
            <Tile
              key={a.id}
              anime={a}
              className={i === 2 ? 'col-span-2' : 'col-span-1'}
              aspect={i === 2 ? '16 / 10' : '3 / 4'}
              size={i === 2 ? 'wide' : 'std'}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- one tile */

type Size = 'hero' | 'wide' | 'std';

function Tile({
  anime, className = '', aspect, size, priority,
}: { anime: Anime; className?: string; aspect: string; size: Size; priority?: boolean }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large || '';
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const studio = mainStudio(anime);
  const airing = anime.status === 'RELEASING';

  return (
    <TiltLink href={`/title/${anime.id}`} chroma={chroma} className={className} aspect={aspect}>
      <SmartImage
        src={src}
        srcLarge={anime.coverImage.extraLarge}
        color={chroma}
        ratio={aspect}
        priority={priority}
        sizes={size === 'hero' ? '(max-width: 1024px) 100vw, 620px' : size === 'wide' ? '(max-width: 640px) 92vw, 420px' : '(max-width: 640px) 45vw, 220px'}
        className="absolute inset-0 h-full w-full"
        imgClassName="transition-transform duration-[900ms] ease-physical group-hover:scale-[1.05]"
      />

      {/* floating badges */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start gap-2">
        {airing && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide backdrop-blur"
            style={{ background: 'rgba(255,255,255,0.82)', color: '#D6224B' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" /> Airing
          </span>
        )}
        {score && (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold backdrop-blur"
            style={{ background: 'rgba(255,255,255,0.82)', color: '#7A5A00' }}
          >
            <Star size={11} className="fill-gold text-gold" aria-hidden /> {score}
          </span>
        )}
      </div>

      {/* light frosted caption bar */}
      <div
        className="absolute inset-x-2 bottom-2 z-20 rounded-[16px] px-3.5 py-3 backdrop-blur-xl"
        style={{
          background: 'rgba(255,255,255,0.74)',
          border: '1px solid rgba(255,255,255,0.7)',
          boxShadow: '0 8px 24px -12px rgba(18,10,40,0.4)',
        }}
      >
        {size !== 'std' && anime.title.native && (
          <p className="truncate font-medium" style={{ color: MUTED, fontSize: 12 }}>
            {anime.title.native}
          </p>
        )}
        <h3
          className={`font-display font-black leading-tight tracking-[-0.02em] ${
            size === 'hero' ? 'text-[clamp(22px,3vw,34px)]' : size === 'wide' ? 'text-lead' : 'text-meta'
          } line-clamp-2`}
          style={{ color: INK }}
        >
          {displayTitle(anime.title)}
        </h3>
        {size !== 'std' && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5" style={{ color: MUTED, fontSize: 12 }}>
            <span>{formatLabel(anime.format)}</span>
            {anime.episodes ? <span>· {anime.episodes} eps</span> : null}
            {studio && <span>· {studio}</span>}
            {anime.popularity ? <span>· {compact(anime.popularity)} watching</span> : null}
          </div>
        )}
        {size === 'hero' && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-meta font-bold"
              style={{ background: `rgb(${chroma})`, color: '#fff' }}
            >
              <Play size={15} className="fill-current" aria-hidden /> Play E1
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-meta font-semibold"
              style={{ background: 'rgba(26,21,35,0.06)', color: INK }}
            >
              <Plus size={15} aria-hidden /> Save
            </span>
          </div>
        )}
      </div>
    </TiltLink>
  );
}

/* ------------------------------------------------------- countdown tile */

function CountdownTile({ anime, className = '' }: { anime: Anime; className?: string }) {
  const chroma = toChromaVar(anime.coverImage.color);
  const src = anime.coverImage.extraLarge || anime.coverImage.large || '';
  const target = useRef(Date.now() + (anime.nextAiringEpisode?.timeUntilAiring ?? 0) * 1000);
  const [left, setLeft] = useState(anime.nextAiringEpisode?.timeUntilAiring ?? 0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => setLeft(Math.max(0, Math.round((target.current - Date.now()) / 1000)));
    tick();
    if (reduce) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells = d > 0
    ? [[String(d), 'days'], [pad(h), 'hrs'], [pad(m), 'min']]
    : [[pad(h), 'hrs'], [pad(m), 'min'], [pad(s), 'sec']];

  return (
    <TiltLink href={`/title/${anime.id}`} chroma={chroma} className={className} aspect="3 / 4">
      <SmartImage
        src={src}
        srcLarge={anime.coverImage.extraLarge}
        color={chroma}
        ratio="3 / 4"
        sizes="(max-width: 640px) 45vw, 220px"
        className="absolute inset-0 h-full w-full"
        imgClassName="transition-transform duration-[900ms] ease-physical group-hover:scale-[1.05]"
      />
      <div
        className="absolute inset-x-2 bottom-2 top-auto z-20 rounded-[16px] px-3.5 py-3 backdrop-blur-xl"
        style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.7)' }}
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: '#8A5CF6' }}>
          Next episode in
        </p>
        <div className="mt-2 flex gap-1.5">
          {cells.map(([v, label]) => (
            <div
              key={label}
              className="flex-1 rounded-[10px] py-1.5 text-center"
              style={{ background: 'rgba(26,21,35,0.05)' }}
            >
              <b className="block font-mono text-lead font-bold tabular-nums" style={{ color: INK }}>{v}</b>
              <small className="font-mono text-[9px] uppercase tracking-wide" style={{ color: MUTED }}>{label}</small>
            </div>
          ))}
        </div>
        <h3 className="mt-2.5 line-clamp-1 font-display text-meta font-black" style={{ color: INK }}>
          {displayTitle(anime.title)}
        </h3>
        <p style={{ color: MUTED, fontSize: 11.5 }}>
          {airingIn(anime.nextAiringEpisode?.timeUntilAiring) ?? 'Airing soon'}
        </p>
      </div>
    </TiltLink>
  );
}

/* ----------------------------------------------------------- score tile */

function ScoreTile({ score, popularity }: { score: number; popularity: number | null }) {
  return (
    <div
      className="relative flex flex-col justify-between rounded-[22px] p-5"
      style={{
        aspectRatio: '3 / 4',
        background: 'linear-gradient(150deg, #FFFFFF, #F3EEFA)',
        border: '1px solid rgba(26,21,35,0.06)',
        boxShadow: '0 1px 2px rgba(18,10,40,0.05), 0 20px 44px -28px rgba(18,10,40,0.3)',
      }}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: '#8A5CF6' }}>
        Community score
      </p>
      <div>
        <div
          className="font-display font-black leading-none tracking-[-0.03em]"
          style={{ fontSize: 'clamp(40px,6vw,58px)', color: INK }}
        >
          {(score / 10).toFixed(1)}
        </div>
        <p className="mt-1" style={{ color: MUTED, fontSize: 12.5 }}>
          {popularity ? `${compact(popularity)} tracking` : 'Top rated this season'}
        </p>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- tilt + glow shell */

function TiltLink({
  href, chroma, className = '', aspect, children,
}: { href: string; chroma: string; className?: string; aspect?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--mx', `${px * 100}%`);
    el.style.setProperty('--my', `${py * 100}%`);
    el.style.transform =
      `perspective(1100px) rotateX(${((0.5 - py) * 5).toFixed(2)}deg) rotateY(${((px - 0.5) * 6).toFixed(2)}deg) translate3d(0,-4px,0)`;
  };
  const reset = () => {
    const el = ref.current;
    if (el) el.style.transform = '';
  };

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`group relative block overflow-hidden rounded-[22px] outline-none ${className}`}
      style={{
        aspectRatio: aspect,
        background: '#fff',
        border: '1px solid rgba(26,21,35,0.07)',
        boxShadow: '0 1px 2px rgba(18,10,40,0.05), 0 18px 40px -26px rgba(18,10,40,0.28)',
        transition: 'transform 0.5s var(--ease-physical, cubic-bezier(0.16,1,0.3,1)), box-shadow 0.45s var(--ease-physical, cubic-bezier(0.16,1,0.3,1))',
        willChange: 'transform',
        ['--glow' as string]: `rgb(${chroma} / 0.5)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          `0 1px 2px rgba(18,10,40,0.06), 0 30px 70px -30px rgb(${chroma} / 0.6), 0 0 0 1px rgb(${chroma} / 0.35)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow =
          '0 1px 2px rgba(18,10,40,0.05), 0 18px 40px -26px rgba(18,10,40,0.28)';
      }}
    >
      {children}
      {/* pointer-tracked neon glow, kept faint on a light ground */}
      <span
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(220px 220px at var(--mx,50%) var(--my,0%), var(--glow), transparent 60%)',
          mixBlendMode: 'multiply',
        }}
        aria-hidden
      />
    </Link>
  );
}

/* ------------------------------------------------------------- helpers */

function dedupe(list: Anime[]): Anime[] {
  const seen = new Set<number>();
  return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}
