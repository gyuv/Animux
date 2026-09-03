'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Play, X } from 'lucide-react';
import type { WatchProgress } from '@/store/useLibrary';
import { useLibrary } from '@/store/useLibrary';
import { toChromaVar } from '@/lib/chroma';
import { remaining, timecode } from '@/lib/format';

/**
 * Resume cards are landscape rather than portrait so they read as "a place you
 * left off" instead of "another thing to start", and so the shelf is visually
 * distinct from every other row on the page without needing a label to say so.
 */
export function ContinueCard({ entry, fill }: { entry: WatchProgress; fill?: boolean }) {
  const clearProgress = useLibrary((s) => s.clearProgress);
  const chroma = toChromaVar(entry.color);
  const pct = entry.duration > 0 ? Math.min(100, (entry.position / entry.duration) * 100) : 0;

  return (
    <div
      style={{ ['--chroma' as string]: chroma }}
      className={`group relative ${fill ? 'w-full' : 'w-[248px] shrink-0 sm:w-[288px]'}`}
    >
      <Link
        href={`/watch/${entry.animeId}?ep=${entry.episode}&t=${Math.floor(entry.position)}`}
        className="block outline-none"
      >
        <div className="relative aspect-video overflow-hidden rounded-art bg-ink-800
                        transition-transform duration-300 ease-physical
                        group-hover:-translate-y-1 group-focus-within:-translate-y-1">
          {entry.cover && (
            <Image
              src={entry.cover}
              alt=""
              fill
              sizes={fill ? '(max-width: 640px) 90vw, 300px' : '288px'}
              className="object-cover opacity-85 transition-opacity duration-300
                         group-hover:opacity-100"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/25 to-transparent" />

          <div
            className="absolute inset-0 grid place-items-center opacity-0 transition-opacity
                       duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <span
              className="grid h-12 w-12 place-items-center rounded-full bg-paper text-ink-900"
              style={{ boxShadow: `0 0 34px rgb(${chroma} / 0.7)` }}
            >
              <Play size={19} className="ml-0.5 fill-ink-900" aria-hidden />
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <p className="px-3 pb-2 text-micro text-haze">
              {timecode(entry.position)} of {timecode(entry.duration)}
            </p>
            <div className="h-[3px] bg-ink-900/80">
              <div className="h-full bg-chroma" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <h3 className="mt-2.5 line-clamp-1 text-meta font-semibold text-paper
                       transition-colors group-hover:text-chroma">
          {entry.title}
        </h3>
        <p className="mt-0.5 text-micro text-haze">
          Episode {entry.episode} — {remaining(entry.position, entry.duration)}
        </p>
      </Link>

      <button
        type="button"
        onClick={() => clearProgress(entry.animeId)}
        aria-label={`Remove ${entry.title} from Continue watching`}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full
                   bg-ink-900/85 text-haze opacity-0 backdrop-blur transition-all
                   duration-200 hover:text-paper focus-visible:opacity-100
                   group-hover:opacity-100"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
