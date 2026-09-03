import Link from 'next/link';
import { searchAnime, AniListError } from '@/services/anilist';
import { FilterBar } from '@/components/search/FilterBar';
import { PosterCard } from '@/components/media/PosterCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CatalogueNotice } from '@/components/ui/CatalogueNotice';

export const metadata = {
  title: 'Browse',
  description: 'Filter the catalogue by genre, format, season, year and score.',
};

type SP = Record<string, string | string[] | undefined>;

const many = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SP> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(one(query.page) ?? 1) || 1);

  let result;
  try {
    result = await searchAnime({
      search: one(query.q),
      genres: many(query.genre),
      excludeGenres: many(query.not),
      tags: many(query.tag),
      formats: many(query.format),
      status: one(query.status),
      season: one(query.season),
      year: query.year ? Number(one(query.year)) : undefined,
      minScore: query.minScore ? Number(one(query.minScore)) : undefined,
      sort: one(query.sort),
      page,
      perPage: 30,
    });
  } catch (error) {
    return (
      <div className="pt-topbar">
        <FilterBar total={0} />
        <EmptyState
          title="Search is unavailable"
          body={
            error instanceof AniListError
              ? error.viewerMessage
              : 'Something went wrong reaching the catalogue.'
          }
          action={<Link href="/browse" className="key-primary">Try again</Link>}
        />
      </div>
    );
  }

  const { media, pageInfo, meta } = result;

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (k === 'page' || v === undefined) return;
      many(v).forEach((val) => p.append(k, val));
    });
    p.set('page', String(n));
    return `/browse?${p.toString()}`;
  };

  return (
    <div className="pt-topbar">
      <FilterBar total={pageInfo.total} />

      {meta.notice && <CatalogueNotice message={meta.notice} />}

      {media.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          body="Try removing a genre, lowering the minimum score, or widening the year."
          action={<Link href="/browse" className="key-primary">Clear filters</Link>}
        />
      ) : (
        <>
          <p className="gutter-x pt-6 text-meta text-haze" aria-live="polite">
            {pageInfo.total.toLocaleString()} {pageInfo.total === 1 ? 'title' : 'titles'}
            {pageInfo.lastPage > 1 && ` · page ${pageInfo.currentPage} of ${pageInfo.lastPage.toLocaleString()}`}
          </p>

          <div
            className="gutter-x grid gap-x-3 gap-y-7 py-5
                       [grid-template-columns:repeat(auto-fill,minmax(144px,1fr))]
                       sm:[grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]"
          >
            {media.map((a, i) => (
              <div key={a.id} className="w-full [&>a]:w-full">
                <PosterCard anime={a} priority={i < 6} sizes="(max-width:640px) 45vw, 180px" />
              </div>
            ))}
          </div>

          <nav className="gutter-x flex items-center justify-between gap-4 pb-16" aria-label="Pagination">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="key-ghost">Previous</Link>
            ) : <span />}
            <p className="text-meta tabular-nums text-haze">
              {pageInfo.currentPage} / {pageInfo.lastPage.toLocaleString()}
            </p>
            {pageInfo.hasNextPage ? (
              <Link href={pageHref(page + 1)} className="key-ghost">Next</Link>
            ) : <span />}
          </nav>
        </>
      )}
    </div>
  );
}
