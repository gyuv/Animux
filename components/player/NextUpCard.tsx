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

  const progress = lead > 0 ? Math.min(1, Math.max(0, (lead - remaining) / lead)) : 1;

  return (
    <div className="absolute bottom-28 right-5 z-20 w-[300px] animate-scale-in">
      <div className="glass overflow-hidden rounded-panel p-4">
        <div className="flex items-start gap-3">
          {autoPlay && <CountdownRing progress={progress} seconds={remaining} />}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-micro uppercase tracking-wider text-haze/70">Up next</p>
                <p className="mt-0.5 font-display text-lead font-bold text-paper">Episode {episode}</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Cancel autoplay"
                className="shrink-0 rounded-full p-1 text-haze transition-colors hover:bg-white/10 hover:text-paper"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            {autoPlay && (
              <p className="mt-1 text-micro text-haze" aria-live="polite">
                Playing in {remaining}s
              </p>
            )}
          </div>
        </div>

        <Link href={href} className="key-chroma mt-3 w-full">
          <Play size={15} className="fill-current" aria-hidden />
          Play now
        </Link>
      </div>
    </div>
  );
}

/**
 * A circle rather than a bar: the same information (how much of the wait is
 * left) read at a glance from across the couch, and the shape a "countdown"
 * reads as everywhere else on the web. `stroke-dashoffset` is the one
 * animatable primitive an SVG ring has for "fill amount", so the transition
 * is on that alone — everything else about the ring is static.
 */
function CountdownRing({ progress, seconds }: { progress: number; seconds: number }) {
  const size = 44;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative grid h-11 w-11 shrink-0 place-items-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(255 255 255 / 0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--chroma))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: 'drop-shadow(0 0 4px rgb(var(--chroma) / 0.7))' }}
        />
      </svg>
      <span className="absolute text-micro font-bold tabular-nums text-paper">{seconds}</span>
    </div>
  );
}
