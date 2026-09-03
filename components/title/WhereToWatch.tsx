import { ExternalLink as ExternalIcon, Play, Globe } from 'lucide-react';
import type { ExternalLink } from '@/services/anilist';

/**
 * Legitimate places to watch this, straight from AniList's link table.
 *
 * Streaming links are separated from information links because they answer
 * different questions — "where can I watch this legally" and "where do I read
 * more about it" — and burying Crunchyroll in a list that also contains a
 * Twitter account helps nobody. Each link carries the site's own brand colour
 * as a left edge, which is the only place in the app a colour is not derived
 * from the artwork.
 */
export function WhereToWatch({ links }: { links: ExternalLink[] }) {
  const streaming = links.filter((l) => l.type === 'STREAMING');
  const info = links.filter((l) => l.type !== 'STREAMING');

  if (links.length === 0) return null;

  return (
    <div className="space-y-6">
      {streaming.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-meta font-semibold uppercase tracking-wider text-haze/70">
            <Play size={13} aria-hidden />
            Watch it legally
          </h3>
          <ul className="flex flex-wrap gap-2">
            {streaming.map((link) => (
              <li key={link.id}><LinkPill link={link} prominent /></li>
            ))}
          </ul>
        </section>
      )}

      {info.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-meta font-semibold uppercase tracking-wider text-haze/70">
            <Globe size={13} aria-hidden />
            Elsewhere
          </h3>
          <ul className="flex flex-wrap gap-2">
            {info.map((link) => (
              <li key={link.id}><LinkPill link={link} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LinkPill({ link, prominent }: { link: ExternalLink; prominent?: boolean }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center gap-2 overflow-hidden rounded-key border
                  pl-0 pr-3 text-meta transition-colors duration-200
                  ${prominent
                    ? 'border-ink-600 bg-ink-800 py-2.5 font-semibold text-paper hover:border-ink-500 hover:bg-ink-700'
                    : 'border-ink-700 bg-ink-800/60 py-2 text-haze hover:text-paper'}`}
    >
      <span
        className="h-full w-1 self-stretch"
        style={{ backgroundColor: link.color ?? 'rgb(var(--chroma))' }}
        aria-hidden
      />
      <span className="pl-1.5">{link.site}</span>
      {link.language && <span className="text-micro text-haze/60">{link.language}</span>}
      <ExternalIcon
        size={12}
        aria-hidden
        className="opacity-50 transition-opacity group-hover:opacity-100"
      />
    </a>
  );
}
