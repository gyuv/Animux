'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Info, Film, Star } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle, mainStudio } from '@/services/anilist';
import { stripHtml, formatLabel } from '@/lib/format';
import { toChromaVar } from '@/lib/chroma';
import { TrailerModal, trailerUrl } from '@/components/media/TrailerModal';

/**
 * The instant glass preview: hovering a card for a beat opens a floating
 * panel with the synopsis, format/score/studio and a fast episode-1 launch,
 * without a page navigation. It is built entirely from the `Anime` object
 * the card already has in memory — every field it reads (description,
 * genres, trailer, studios) is already part of the list query every rail
 * and grid runs — rather than firing a request per hover. A grid of forty
 * cards on a free-tier deployment cannot each open a network round trip the
 * instant a cursor passes over them; character-level detail (which does
 * need its own query) stays on the title page, one real click away.
 *
 * Rendered through a portal to `document.body` and positioned `fixed` from
 * the card's own bounding rect, so it is never clipped by the horizontal
 * rail it lives in — an absolutely-positioned popover anchored inside an
 * `overflow-x-auto` track would be cut off the moment it extended past the
 * card itself.
 */

const OPEN_DELAY = 420;
const CLOSE_DELAY = 150;
const PANEL_W = 320;

export function useCardPreview<T extends HTMLElement>(anime: Anime) {
  const ref = useRef<T>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  const onMouseEnter = useCallback(() => {
    // Touch has no hover to speak of — a tap should go straight to the
    // title page, not stall behind a preview it has no way to dismiss.
    if (window.matchMedia('(pointer: coarse)').matches) return;
    clearTimers();
    openTimer.current = setTimeout(() => {
      setAnchor(ref.current?.getBoundingClientRect() ?? null);
      setOpen(true);
    }, OPEN_DELAY);
  }, []);

  const onMouseLeave = useCallback(() => {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  }, []);

  const holdOpen = useCallback(() => clearTimers(), []);
  const close = useCallback(() => { clearTimers(); setOpen(false); }, []);

  useEffect(() => clearTimers, []);

  // A scroll invalidates the captured anchor rect faster than it is worth
  // re-measuring on every frame, so the panel simply steps aside.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open, close]);

  const panel = open && anchor
    ? <PreviewPanel anime={anime} anchor={anchor} onHold={holdOpen} onLeave={onMouseLeave} onClose={close} />
    : null;

  return { ref, onMouseEnter, onMouseLeave, panel };
}

function PreviewPanel({
  anime,
  anchor,
  onHold,
  onLeave,
  onClose,
}: {
  anime: Anime;
  anchor: DOMRect;
  onHold: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const chroma = toChromaVar(anime.coverImage.color);
  const synopsis = stripHtml(anime.description);
  const studio = mainStudio(anime);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const hasTrailer = Boolean(trailerUrl(anime.trailer));

  const gap = 14;
  const openRight = anchor.right + gap + PANEL_W <= window.innerWidth;
  const left = openRight ? anchor.right + gap : Math.max(8, anchor.left - gap - PANEL_W);
  const estHeight = 340;
  const top = Math.min(
    Math.max(8, anchor.top + anchor.height / 2 - estHeight / 2),
    window.innerHeight - estHeight - 8,
  );

  return createPortal(
    <div
      role="dialog"
      aria-label={`Preview: ${displayTitle(anime.title)}`}
      onMouseEnter={onHold}
      onMouseLeave={onLeave}
      style={{ ['--chroma' as string]: chroma, top, left, width: PANEL_W }}
      className="glass fixed z-[90] animate-scale-in overflow-hidden rounded-panel"
    >
      <div
        className="h-1"
        style={{ background: 'linear-gradient(90deg, #8B5CF6, rgb(var(--chroma)), #00F2FE)' }}
        aria-hidden
      />
      <div className="p-4">
        <h3 className="line-clamp-2 font-display text-lead font-bold text-paper">
          {displayTitle(anime.title)}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-micro text-haze">
          {score && (
            <span className="inline-flex items-center gap-1 font-semibold text-gold">
              <Star size={11} className="fill-current" aria-hidden />
              {score}
            </span>
          )}
          <span>{formatLabel(anime.format)}</span>
          {anime.episodes ? <span>{anime.episodes} ep</span> : null}
          {studio && <span className="truncate">{studio}</span>}
        </div>

        {anime.genres.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {anime.genres.slice(0, 3).map((g) => (
              <span key={g} className="chip py-1 text-[10px]">{g}</span>
            ))}
          </div>
        )}

        {synopsis && (
          <p className="mt-3 line-clamp-4 text-micro leading-relaxed text-haze">{synopsis}</p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Link href={`/watch/${anime.id}?ep=1`} className="key-chroma flex-1 !px-3 !py-2 text-micro">
            <Play size={14} className="fill-current" aria-hidden />
            Play
          </Link>
          {hasTrailer && (
            <button
              type="button"
              onClick={() => setTrailerOpen(true)}
              aria-label="Play trailer"
              className="key-ghost !px-2.5 !py-2"
            >
              <Film size={14} aria-hidden />
            </button>
          )}
          <Link href={`/title/${anime.id}`} aria-label="Full details" className="key-ghost !px-2.5 !py-2">
            <Info size={14} aria-hidden />
          </Link>
        </div>
      </div>

      <TrailerModal
        trailer={anime.trailer}
        title={displayTitle(anime.title)}
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
      />
    </div>,
    document.body,
  );
}
