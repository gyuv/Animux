import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getHome, currentSeason, nextSeason, AniListError, displayTitle } from '@/services/anilist';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { Rail } from '@/components/media/Rail';
import { PosterCard } from '@/components/media/PosterCard';
import { RankCard } from '@/components/media/RankCard';
import { ContinueShelf } from '@/components/media/ContinueShelf';
import { AiringStrip } from '@/components/home/AiringStrip';
import { EmptyState } from '@/components/ui/EmptyState';
import { CatalogueNotice } from '@/components/ui/CatalogueNotice';
import { season as seasonLabel } from '@/lib/format';

export const revalidate = 1800;

export default async function HomePage() {
  const now = currentSeason();
  const soon = nextSeason();

  let shelves;
  let notice: string | null = null;

  try {
    const home = await getHome();
    shelves = home.shelves;
    notice = home.meta.notice;
  } catch (error) {
    return (
      <EmptyState
        title="The catalogue is not answering"
        body={
          error instanceof AniListError
            ? error.viewerMessage
            : 'Something went wrong loading the catalogue.'
        }
        action={<Link href="/" className="key-primary">Try again</Link>}
      />
    );
  }

  const { trending, seasonal, upcoming, allTime, popular, movies } = shelves;
  const featured = trending.slice(0, 5);
  const restOfTrending = trending.slice(5);

  // Anything with a broadcast inside the next 48 hours, soonest first.
  const airingSoon = [...trending, ...seasonal]
    .filter((a) => a.nextAiringEpisode && a.nextAiringEpisode.timeUntilAiring < 172800)
    .filter((a, i, list) => list.findIndex((b) => b.id === a.id) === i)
    .sort((a, b) => a.nextAiringEpisode!.timeUntilAiring - b.nextAiringEpisode!.timeUntilAiring)
    .slice(0, 12);

  return (
    <>
      {featured.length > 0 && <HeroCarousel items={featured} />}

      {notice && <CatalogueNotice message={notice} />}

      <ContinueShelf />

      {airingSoon.length > 0 && <AiringStrip items={airingSoon} />}

      {allTime.length > 0 && (
        <Rail
          title="The ten best, ever"
          note="Ranked by every score AniList has on file"
          action={<SeeAll href="/browse?sort=SCORE_DESC" />}
        >
          {allTime.map((a, i) => (
            <RankCard key={a.id} anime={a} rank={i + 1} />
          ))}
        </Rail>
      )}

      {restOfTrending.length > 0 && (
        <Rail
          title="Trending this week"
          note="What people are actually opening right now"
          action={<SeeAll href="/browse?sort=TRENDING_DESC" />}
        >
          {restOfTrending.map((a, i) => (
            <PosterCard key={a.id} anime={a} priority={i < 4} />
          ))}
        </Rail>
      )}

      {seasonal.length > 0 && (
        <Rail
          title={`Airing now — ${seasonLabel(now.season, now.year)}`}
          note="New episodes landing this season"
          action={<SeeAll href={`/browse?season=${now.season}&year=${now.year}&sort=POPULARITY_DESC`} />}
        >
          {seasonal.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      {upcoming.length > 0 && (
        <Rail
          title={`Coming in ${seasonLabel(soon.season, soon.year)}`}
          note="Announced, not yet broadcast"
          action={<SeeAll href={`/browse?season=${soon.season}&year=${soon.year}&sort=POPULARITY_DESC`} />}
        >
          {upcoming.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      {movies.length > 0 && (
        <Rail
          title="Films"
          note="One sitting, no cliffhanger"
          action={<SeeAll href="/browse?format=MOVIE&sort=SCORE_DESC" />}
        >
          {movies.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      {popular.length > 0 && (
        <Rail
          title="Everyone has seen these"
          note="The most-watched titles on record"
          action={<SeeAll href="/browse?sort=POPULARITY_DESC" />}
        >
          {popular.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      <GenreGrid />

      <div className="h-12" />
    </>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-meta text-haze transition-colors hover:text-paper"
    >
      See all
      <ArrowRight
        size={14}
        aria-hidden
        className="transition-transform duration-200 ease-physical group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/**
 * A closing shelf that is not another row of posters. Genres are the way most
 * people describe what they want to watch, and the browse page can already
 * answer every one of them — this is just the door.
 */
const GENRE_TILES: { genre: string; blurb: string; from: string; to: string }[] = [
  { genre: 'Action', blurb: 'Fights, chases, stakes', from: '#FF4D6D', to: '#7A2740' },
  { genre: 'Romance', blurb: 'Slow looks, long pauses', from: '#F58AB0', to: '#5E2A45' },
  { genre: 'Slice of Life', blurb: 'Small days, low stakes', from: '#7FD1AE', to: '#254A3E' },
  { genre: 'Psychological', blurb: 'Unreliable everything', from: '#9B8CFF', to: '#2E2857' },
  { genre: 'Sci-Fi', blurb: 'Futures, near and far', from: '#5BC8F5', to: '#1E3D52' },
  { genre: 'Comedy', blurb: 'Timing above all', from: '#F5C542', to: '#54430F' },
  { genre: 'Mystery', blurb: 'Something is off', from: '#B58CF5', to: '#3A2757' },
  { genre: 'Sports', blurb: 'Practice, then payoff', from: '#63E6A0', to: '#1F4A33' },
];

function GenreGrid() {
  return (
    <section className="py-8">
      <header className="gutter-x mb-4">
        <h2 className="section-title">Browse by mood</h2>
        <p className="mt-0.5 text-meta text-haze">Eight doors into the catalogue</p>
      </header>

      <div className="gutter-x grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
        {GENRE_TILES.map(({ genre, blurb, from, to }) => (
          <Link
            key={genre}
            href={`/browse?genre=${encodeURIComponent(genre)}&sort=SCORE_DESC`}
            className="group relative overflow-hidden rounded-panel border border-white/[0.06] p-4 pb-5
                       transition-transform duration-300 ease-physical hover:-translate-y-1"
          >
            <span
              className="absolute inset-0 opacity-[0.22] transition-opacity duration-300 group-hover:opacity-40"
              style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
              aria-hidden
            />
            <span className="relative block font-display text-lead font-bold text-paper">{genre}</span>
            <span className="relative mt-0.5 block text-micro text-haze">{blurb}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
