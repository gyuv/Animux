import { searchAnime, AniListError } from '@/services/anilist';
import { Hero } from '@/components/media/Hero';
import { Rail } from '@/components/media/Rail';
import { PosterCard } from '@/components/media/PosterCard';
import { ContinueShelf } from '@/components/media/ContinueShelf';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

export const revalidate = 3600;

function currentSeason() {
  const m = new Date().getMonth();
  const season = m < 2 ? 'WINTER' : m < 5 ? 'SPRING' : m < 8 ? 'SUMMER' : 'FALL';
  return { season, year: new Date().getFullYear() };
}

export default async function HomePage() {
  const { season, year } = currentSeason();

  let shelves;
  try {
    // Keep the initial AniList burst small. The server-side fetch cache still
    // makes each shelf reusable, while sequential requests are much less
    // likely to trip AniList's short-window rate limiter.
    const trending = await searchAnime({ sort: 'TRENDING_DESC', perPage: 20 });
    const airing = await searchAnime({ season, year, status: 'RELEASING', sort: 'POPULARITY_DESC', perPage: 20 });
    const top = await searchAnime({ sort: 'SCORE_DESC', perPage: 20, minScore: 80 });
    const calm = await searchAnime({ genres: ['Slice of Life'], sort: 'SCORE_DESC', perPage: 20 });
    shelves = [trending, airing, top, calm];
  } catch (error) {
    return (
      <EmptyState
        title="The catalogue is not answering"
        body={error instanceof AniListError ? error.message : 'Something went wrong loading the catalogue.'}
        action={<Link href="/" className="key-primary">Try again</Link>}
      />
    );
  }

  const [trending, airing, top, calm] = shelves;
  const feature = trending.media[0];
  const rest = trending.media.slice(1);

  return (
    <>
      {feature && <Hero anime={feature} />}

      <ContinueShelf />

      <Rail
        title="Trending this week"
        action={<Link href="/browse?sort=TRENDING_DESC" className="text-meta text-haze hover:text-paper">See all</Link>}
      >
        {rest.map((a, i) => (
          <PosterCard key={a.id} anime={a} priority={i < 4} />
        ))}
      </Rail>

      <Rail title="Airing now" note="New episodes landing this season">
        {airing.media.map((a) => (
          <PosterCard key={a.id} anime={a} />
        ))}
      </Rail>

      <Rail
        title="Highest rated"
        action={<Link href="/browse?sort=SCORE_DESC" className="text-meta text-haze hover:text-paper">See all</Link>}
      >
        {top.media.map((a) => (
          <PosterCard key={a.id} anime={a} />
        ))}
      </Rail>

      <Rail title="Something gentler" note="Slower stories, low stakes">
        {calm.media.map((a) => (
          <PosterCard key={a.id} anime={a} />
        ))}
      </Rail>

      <div className="h-10" />
    </>
  );
}
