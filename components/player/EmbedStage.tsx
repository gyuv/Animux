'use client';

import Link from 'next/link';
import { ChevronLeft, Info } from 'lucide-react';
import { SERVERS, AUTO_SERVER } from '@/lib/providers/servers';

/**
 * An external player, in a frame.
 *
 * This is the one path where the video is fetched by the viewer's browser
 * rather than by the server, which is why it exists at all: these hosts
 * routinely refuse datacentre addresses while serving a home connection
 * without complaint, so a frame can play an episode that every server-side
 * route has been refused.
 *
 * Nothing inside it can be driven from here. It is another origin, so the
 * app's controls, subtitle styling, skip-intro, resume and progress tracking
 * all stop at the boundary — and pretending otherwise by drawing a fake
 * control bar over it would be worse than saying so. What is offered instead
 * is the one control that still means something: switching to a different
 * server.
 */

interface Props {
  animeId: string;
  title: string;
  episode: number;
  /** The frame's URL, loaded by the browser rather than proxied. */
  src: string;
  currentServer: string;
  onPickServer: (id: string) => void;
}

export function EmbedStage({
  animeId, title, episode, src, currentServer, onPickServer,
}: Props) {
  return (
    <div className="relative flex min-h-svh flex-col bg-black">
      <header className="flex items-center gap-3 px-gutter py-3">
        <Link
          href={`/title/${animeId}`}
          className="inline-flex items-center gap-1 text-meta text-haze transition-colors hover:text-paper"
        >
          <ChevronLeft size={16} aria-hidden />
          Episodes
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-meta font-semibold text-paper">{title}</p>
        </div>
        <span className="shrink-0 text-micro text-haze">Episode {episode}</span>
      </header>

      <div className="relative w-full flex-1 bg-black">
        <iframe
          key={src}
          src={src}
          title={`${title} — episode ${episode}`}
          className="absolute inset-0 h-full w-full border-0"
          /*
           * allow-same-origin refers to the frame's own origin, not this app's,
           * so the player can keep its own storage and still cannot reach
           * anything here. Popups are blocked, which is most of what these
           * pages would otherwise do.
           */
          sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="origin"
        />
      </div>

      <footer className="px-gutter py-4">
        <p className="flex items-start gap-2 text-micro text-haze">
          <Info size={13} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            This server plays in its own player, so skip-intro, subtitle size and
            resume are unavailable here — and this episode will not be added to
            Continue watching. Pick another server below for the full player.
          </span>
        </p>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Streaming server">
          {[AUTO_SERVER, ...SERVERS].map((s) => {
            const active = currentServer === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPickServer(s.id)}
                aria-pressed={active}
                className={`rounded-key border px-3 py-1.5 text-meta transition-colors ${
                  active
                    ? 'border-chroma bg-chroma/15 font-semibold text-paper'
                    : 'border-ink-600 text-haze hover:border-ink-500 hover:text-paper'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
