import Link from 'next/link';
import { searchAnimeSafe, type SearchResult } from '@/services/anilist';
import { Hero } from '@/components/media/Hero';
import { Rail } from '@/components/media/Rail';
import { PosterCard } from '@/components/media/PosterCard';
import { ContinueShelf } from '@/components/media/ContinueShelf';
import { EmptyState } from '@/components/ui/EmptyState';
import { CatalogueNotice } from '@/components/ui/CatalogueNotice';

export const revalidate = 3600;

function currentSeason() {
  const m = new Date().getMonth();
  const season = m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL';
  return { season, year: new Date().getFullYear() };
}

export default async function HomePage() {
  const { season, year } = currentSeason();

  /**
   * Sequential, not `Promise.all`. Four simultaneous requests is precisely the
   * burst that trips AniList's limiter, and the shelves below the fold are not
   * worth racing for. The rate limiter would serialise these anyway; asking for
   * them in order just makes that visible.
   *
   * Each shelf is fetched safely, so a single failure costs one row rather than
   * the whole page.
   */
  const trending = await searchAnimeSafe({ sort: 'TRENDING_DESC', perPage: 20 });
  const airing = await searchAnimeSafe({
    season,
    year,
    status: 'RELEASING',
    sort: 'POPULARITY_DESC',
    perPage: 20,
  });
  const top = await searchAnimeSafe({ sort: 'SCORE_DESC', perPage: 20, minScore: 80 });
  const calm = await searchAnimeSafe({ genres: ['Slice of Life'], sort: 'SCORE_DESC', perPage: 20 });

  const shelves = [trending, airing, top, calm];
  const everythingFailed = shelves.every((s) => s.media.length === 0);

  if (everythingFailed) {
    const reason = shelves.find((s) => s.meta.notice)?.meta.notice;
    return (
      <EmptyState
        title="The catalogue is not answering"
        body={
          reason ??
          'AniList, which supplies Animux with titles and artwork, is not responding right now.'
        }
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/" className="key-primary">Try again</Link>
            <Link href="/library" className="key-ghost">Go to your library</Link>
          </div>
        }
      />
    );
  }

  // Only one banner, even if several shelves are degraded — the cause is shared.
  const notice = shelves.find((s: SearchResult) => s.meta.notice)?.meta.notice ?? null;

  const feature = trending.media[0];
  const rest = trending.media.slice(1);

  return (
    <>
      {feature && <Hero anime={feature} />}

      {notice && <CatalogueNotice message={notice} />}

      <ContinueShelf />

      {rest.length > 0 && (
        <Rail
          title="Trending this week"
          action={
            <Link href="/browse?sort=TRENDING_DESC" className="text-meta text-haze hover:text-paper">
              See all
            </Link>
          }
        >
          {rest.map((a, i) => (
            <PosterCard key={a.id} anime={a} priority={i < 4} />
          ))}
        </Rail>
      )}

      {airing.media.length > 0 && (
        <Rail title="Airing now" note="New episodes landing this season">
          {airing.media.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      {top.media.length > 0 && (
        <Rail
          title="Highest rated"
          action={
            <Link href="/browse?sort=SCORE_DESC" className="text-meta text-haze hover:text-paper">
              See all
            </Link>
          }
        >
          {top.media.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      {calm.media.length > 0 && (
        <Rail title="Something gentler" note="Slower stories, low stakes">
          {calm.media.map((a) => (
            <PosterCard key={a.id} anime={a} />
          ))}
        </Rail>
      )}

      <div className="h-10" />
    </>
  );
}
