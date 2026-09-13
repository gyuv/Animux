'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Trailers are the one piece of video Animux can legitimately show for any
 * title, so they are worth doing properly: the embed is only mounted while the
 * dialog is open — an iframe left in the tree keeps a YouTube player alive and
 * autoplays audio the moment it is unhidden.
 */

export interface Trailer {
  id: string;
  site: string;
}

export function trailerUrl(trailer?: Trailer | null): string | null {
  if (!trailer?.id) return null;
  if (trailer.site === 'youtube') {
    return `https://www.youtube-nocookie.com/embed/${trailer.id}?autoplay=1&rel=0&modestbranding=1`;
  }
  if (trailer.site === 'dailymotion') {
    return `https://www.dailymotion.com/embed/video/${trailer.id}?autoplay=1`;
  }
  return null;
}

/**
 * The same trailer as a silent, looping backdrop — no sound, no chrome, no
 * clicks. Muted is what lets it autoplay at all: browsers block autoplay with
 * audio, so an unmuted background video would simply sit paused. Looping keeps
 * a short trailer from ending on a black frame; the controls, keyboard, related
 * videos and fullscreen are all turned off so it reads as motion, not a player.
 */
export function backgroundTrailerUrl(trailer?: Trailer | null): string | null {
  if (!trailer?.id) return null;
  if (trailer.site === 'youtube') {
    return (
      `https://www.youtube-nocookie.com/embed/${trailer.id}` +
      `?autoplay=1&mute=1&loop=1&playlist=${trailer.id}` +
      `&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1`
    );
  }
  if (trailer.site === 'dailymotion') {
    return (
      `https://www.dailymotion.com/embed/video/${trailer.id}` +
      `?autoplay=1&mute=1&loop=1&controls=0&ui-logo=0&ui-start-screen-info=0`
    );
  }
  return null;
}

export function TrailerModal({
  trailer,
  title,
  open,
  onClose,
}: {
  trailer?: Trailer | null;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const src = trailerUrl(trailer);
  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center p-4 animate-fade"
      role="dialog"
      aria-modal="true"
      aria-label={`Trailer for ${title}`}
    >
      <button
        type="button"
        aria-label="Close trailer"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/90 backdrop-blur-md"
      />

      <div className="relative w-full max-w-[1100px] animate-scale-in">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="truncate font-display text-title font-bold text-paper">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink-600
                       bg-ink-800/80 text-paper transition-colors hover:bg-ink-700"
          >
            <X size={17} aria-hidden />
          </button>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-panel bg-black
                        shadow-[0_40px_120px_-30px_rgb(var(--chroma)/0.45)]">
          <iframe
            src={src}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
