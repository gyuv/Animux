import Link from 'next/link';
import type { AnimeDetail } from '@/services/anilist';
import { allStudios } from '@/services/anilist';
import {
  formatLabel, statusLabel, sourceLabel, countryLabel,
  season as seasonLabel, dateRange, compact,
} from '@/lib/format';

/**
 * The production record: everything a viewer might want to know that is not a
 * paragraph of plot.
 *
 * Rows with nothing in them are dropped rather than printed as an em dash. A
 * fact sheet half full of "—" trains people to stop reading it, and AniList's
 * coverage of runtime, source and studio credits is genuinely patchy on older
 * and smaller titles.
 */
export function FactSheet({ anime }: { anime: AnimeDetail }) {
  const studios = allStudios(anime);
  const main = studios.filter((s) => s.isMain);
  const producers = studios.filter((s) => !s.isMain);

  const rows: [string, React.ReactNode][] = [];
  const push = (label: string, value: React.ReactNode) => {
    if (value !== null && value !== undefined && value !== '' && value !== '—') rows.push([label, value]);
  };

  push('Format', formatLabel(anime.format));
  push('Status', statusLabel(anime.status));
  push('Episodes', anime.episodes ? String(anime.episodes) : null);
  push('Episode length', anime.duration ? `${anime.duration} min` : null);
  push('Season', seasonLabel(anime.season, anime.seasonYear) || null);
  push('Broadcast', dateRange(anime.startDate, anime.endDate));
  push('Source', sourceLabel(anime.source));
  push('Country', countryLabel(anime.countryOfOrigin));
  push(
    'Studio',
    main.length > 0 ? (
      <span className="flex flex-wrap gap-x-1.5">
        {main.map((s) => <span key={s.name}>{s.name}</span>)}
      </span>
    ) : null,
  );
  push(
    'Producers',
    producers.length > 0 ? producers.map((s) => s.name).join(', ') : null,
  );
  push('On watchlists', anime.popularity ? compact(anime.popularity) : null);
  push('Favourited', anime.favourites ? compact(anime.favourites) : null);
  push(
    'Hashtag',
    anime.hashtag ? (
      <span className="flex flex-wrap gap-1.5">
        {anime.hashtag.split(/\s+/).filter(Boolean).map((tag) => (
          <a
            key={tag}
            href={`https://twitter.com/hashtag/${encodeURIComponent(tag.replace('#', ''))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-chroma hover:underline"
          >
            {tag}
          </a>
        ))}
      </span>
    ) : null,
  );

  return (
    <div className="space-y-8">
      <dl className="grid gap-x-8 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(160px,1fr))]">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-micro text-haze/70">{label}</dt>
            <dd className="mt-0.5 text-meta font-medium text-paper">{value}</dd>
          </div>
        ))}
      </dl>

      {anime.genres.length > 0 && (
        <section>
          <h3 className="mb-3 text-meta font-semibold uppercase tracking-wider text-haze/70">Genres</h3>
          <ul className="flex flex-wrap gap-2">
            {anime.genres.map((genre) => (
              <li key={genre}>
                <Link href={`/browse?genre=${encodeURIComponent(genre)}`} className="chip">
                  {genre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {anime.synonyms.length > 0 && (
        <section>
          <h3 className="mb-2 text-meta font-semibold uppercase tracking-wider text-haze/70">
            Also known as
          </h3>
          <p className="text-meta text-haze">{anime.synonyms.slice(0, 8).join(' · ')}</p>
        </section>
      )}
    </div>
  );
}
