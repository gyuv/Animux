'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Copy, Check, RefreshCw, Activity } from 'lucide-react';

/**
 * What the player shows when every source refused.
 *
 * The important part is the per-provider detail. The API distinguishes four
 * failures that need four different fixes — the host refused, it returned
 * nothing, it returned the wrong show, or it ran out of time — and the player
 * used to discard all of that and print one generic line, so the only way to
 * see it was to call the endpoint by hand. Diagnostics nobody can reach are
 * not diagnostics.
 */
export function PlaybackFailure({
  animeId,
  title,
  episode,
  message,
  detail,
}: {
  animeId: string;
  title: string;
  episode: number;
  message: string;
  detail?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const lines = (detail ?? '').split(' | ').map((l) => l.trim()).filter(Boolean);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Animux playback failure\n${title} — episode ${episode}\n${message}\n\n${lines.join('\n')}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard is blocked in some contexts; the text is on screen anyway. */
    }
  };

  return (
    <div className="min-h-svh bg-ink-900 px-6 py-10">
      <div className="mx-auto max-w-[68ch]">
        <Link
          href={`/title/${animeId}`}
          className="mb-8 inline-flex items-center gap-2 text-meta text-haze transition-colors hover:text-paper"
        >
          <ArrowLeft size={15} aria-hidden />
          Back to {title}
        </Link>

        <h1 className="font-display text-hero font-black leading-tight text-paper">
          No source would play episode {episode}
        </h1>
        <p className="mt-2 text-body text-haze">{message}</p>

        {lines.length > 0 && (
          <section className="mt-8 rounded-panel border border-ink-700 bg-ink-800/60 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-meta font-semibold uppercase tracking-wider text-haze/70">
                What each source said
              </h2>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 text-micro text-haze transition-colors hover:text-paper"
              >
                {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                {copied ? 'Copied' : 'Copy all'}
              </button>
            </div>

            <ul className="space-y-2.5">
              {lines.map((line) => (
                <li
                  key={line}
                  className="rounded-key border border-ink-700 bg-ink-900/60 px-3 py-2
                             font-mono text-micro leading-relaxed text-haze"
                >
                  {line}
                </li>
              ))}
            </ul>

            {/* Naming the four shapes turns a wall of text into a decision. */}
            <dl className="mt-4 space-y-1 text-micro text-haze/60">
              <div><dt className="inline font-semibold">threw</dt>{' — '}<dd className="inline">the host refused or moved; that source needs replacing.</dd></div>
              <div><dt className="inline font-semibold">no candidates</dt>{' — '}<dd className="inline">it answered but knows nothing by that name.</dd></div>
              <div><dt className="inline font-semibold">scored below</dt>{' — '}<dd className="inline">it found shows, none close enough to risk playing.</dd></div>
              <div><dt className="inline font-semibold">did not respond in time</dt>{' — '}<dd className="inline">too slow for the request budget.</dd></div>
            </dl>
          </section>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => location.reload()} className="key-primary">
            <RefreshCw size={15} aria-hidden />
            Try again
          </button>
          <a href="/api/stream/health" target="_blank" rel="noopener noreferrer" className="key-ghost">
            <Activity size={15} aria-hidden />
            Check sources
          </a>
          <Link href={`/title/${animeId}`} className="key-ghost">Back to episodes</Link>
        </div>
      </div>
    </div>
  );
}
