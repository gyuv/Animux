'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { MediaTag } from '@/services/anilist';

/**
 * AniList's tags are crowd-ranked, and the rank is the interesting part: a
 * "Time Loop" at 94% is a description of the show, the same tag at 12% is
 * someone's stray vote. The percentage is drawn as a fill behind the label so
 * the strength of a tag reads before the number does.
 *
 * Spoiler tags stay behind a click. They are marked as spoilers for a reason,
 * and showing them by default on a page a viewer opens *before* watching is
 * the single worst thing a detail page can do.
 */
export function TagCloud({ tags }: { tags: MediaTag[] }) {
  const [revealed, setRevealed] = useState(false);

  const safe = tags.filter((t) => !t.isMediaSpoiler && !t.isGeneralSpoiler);
  const spoilers = tags.filter((t) => t.isMediaSpoiler || t.isGeneralSpoiler);

  if (tags.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 text-meta font-semibold uppercase tracking-wider text-haze/70">Tags</h3>

      <ul className="flex flex-wrap gap-2">
        {safe.map((tag) => (
          <li key={tag.id}><Tag tag={tag} /></li>
        ))}
      </ul>

      {spoilers.length > 0 && (
        <div className="mt-4">
          {revealed ? (
            <ul className="flex flex-wrap gap-2">
              {spoilers.map((tag) => (
                <li key={tag.id}><Tag tag={tag} spoiler /></li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="chip border-dashed"
            >
              <EyeOff size={13} aria-hidden />
              Show {spoilers.length} spoiler {spoilers.length === 1 ? 'tag' : 'tags'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function Tag({ tag, spoiler }: { tag: MediaTag; spoiler?: boolean }) {
  const rank = tag.rank ?? 0;

  return (
    <Link
      href={`/browse?tag=${encodeURIComponent(tag.name)}`}
      title={tag.description ?? undefined}
      className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-full
                  border px-3 py-1.5 text-micro font-medium transition-colors duration-200
                  ${spoiler
                    ? 'border-signal/40 text-signal/90 hover:border-signal'
                    : 'border-ink-600 text-haze hover:text-paper'}`}
    >
      {/* Rank as a fill, so the tag list reads as a bar chart at a glance. */}
      <span
        className="absolute inset-y-0 left-0 -z-10 transition-[width] duration-500 ease-physical"
        style={{
          width: `${rank}%`,
          background: spoiler ? 'rgb(255 77 109 / 0.16)' : 'rgb(var(--chroma) / 0.18)',
        }}
        aria-hidden
      />
      {tag.name}
      {rank > 0 && (
        <span className="tabular-nums text-[10px] text-haze/60 group-hover:text-haze">{rank}%</span>
      )}
    </Link>
  );
}
