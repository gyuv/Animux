import Link from 'next/link';
import { searchAnime, AniListError } from '@/services/anilist';
import { FilterBar } from '@/components/search/FilterBar';
import { PosterCard } from '@/components/media/PosterCard';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata = { title: 'Browse' };

type SP = Record<string, string | string[] | undefined>;

const many = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function BrowsePage({ searchParams }: { searchParams: SP }) {
  const page = Number(one(searchParams.page) ?? 1);

  let result;
  try {
    result = await searchAnime({
      search: one(searchParams.q),
      genres: many(searchParams.genre),
      excludeGenres: many(searchParams.not),
      formats: many(searchParams.format),
      status: one(searchParams.status),
      season: one(searchParams.season),
      year: searchParams.year ? Number(one(searchParams.year)) : undefined,
      sort: one(searchParams.sort),
      page,
      perPage: 30,
    });
  } catch (error) {
    return (
      <>
        <FilterBar total={0} />
        <EmptyState
          title="Search is unavailable"
          body={error instanceof AniListError ? error.message : 'Something went wrong reaching the catalogue.'}
        />
      </>
    );
  }

  const { media, pageInfo } = result;

  const nextHref = (n: number) => {
    const p = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (k === 'page' || v === undefined) return;
      many(v).forEach((val) => p.append(k, val));
    });
    p.set('page', String(n));
    return `/browse?${p.toString()}`;
  };

  return (
    <>
      <FilterBar total={pageInfo.total} />

      {media.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          body="Try removing a genre or widening the year range."
          action={<Link href="/browse" className="key-primary">Clear filters</Link>}
        />
      ) : (
        <>
          <div
            className="gutter-x grid gap-x-3 gap-y-7 py-7
                       [grid-template-columns:repeat(auto-fill,minmax(144px,1fr))]
                       sm:[grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]"
          >
            {media.map((a, i) => (
              <div key={a.id} className="w-full [&>a]:w-full">
                <PosterCard anime={a} priority={i < 6} sizes="(max-width:640px) 45vw, 180px" />
              </div>
            ))}
          </div>

          <nav className="gutter-x flex items-center justify-between pb-14" aria-label="Pagination">
            {page > 1 ? (
              <Link href={nextHref(page - 1)} className="key-ghost">Previous</Link>
            ) : <span />}
            <p className="text-meta text-haze">
              Page {pageInfo.currentPage} of {pageInfo.lastPage.toLocaleString()}
            </p>
            {pageInfo.hasNextPage ? (
              <Link href={nextHref(page + 1)} className="key-ghost">Next</Link>
            ) : <span />}
          </nav>
        </>
      )}
    </>
  );
}
