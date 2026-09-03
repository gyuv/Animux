'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';

/**
 * The autoplay card. The README of the previous build listed this as "the
 * preference is stored and read; the handler is not wired" — this is the
 * handler.
 *
 * Two rules make autoplay tolerable rather than hostile: the countdown is
 * visible for its whole duration, and cancelling it once cancels it for the
 * rest of the episode. A card that reappears three seconds after you dismissed
 * it is worse than no card.
 */
export function NextUpCard({
  href,
  episode,
  autoPlay,
  remaining,
  lead,
}: {
  href: string;
  episode: number;
  autoPlay: boolean;
  /** Seconds of episode left, straight from the player's clock. */
  remaining: number;
  /** How early the card appears, so the bar has something to fill against. */
  lead: number;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!autoPlay || dismissed) return;
    if (remaining > 0) return;
    router.push(href);
  }, [autoPlay, dismissed, remaining, href, router]);

  // Prefetching means the next episode's shell is already there when the
  // countdown hits zero, rather than a blank frame and then a spinner.
  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  if (dismissed) return null;

  return (
    <div className="absolute bottom-28 right-5 z-20 w-[300px] animate-scale-in">
      <div className="glass overflow-hidden rounded-panel p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-micro uppercase tracking-wider text-haze/70">Up next</p>
            <p className="mt-0.5 font-display text-lead font-bold text-paper">Episode {episode}</p>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Cancel autoplay"
            className="rounded-full p-1 text-haze transition-colors hover:bg-white/10 hover:text-paper"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {autoPlay && (
          <>
            <p className="mt-2 text-meta text-haze" aria-live="polite">
              Playing in {remaining}s
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-chroma transition-[width] duration-500 ease-linear"
                style={{ width: `${lead > 0 ? Math.min(100, ((lead - remaining) / lead) * 100) : 100}%` }}
              />
            </div>
          </>
        )}

        <Link href={href} className="key-chroma mt-3 w-full">
          <Play size={15} className="fill-current" aria-hidden />
          Play now
        </Link>
      </div>
    </div>
  );
}
