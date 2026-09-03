import { NextRequest, NextResponse } from 'next/server';
import { searchAnime, AniListError, type SearchParams } from '@/services/anilist';

/** GET-shaped mirror of /api/catalogue, for links and native shells that
 *  cannot easily POST. Same gate, same cache, same failure contract. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const arrayParam = (value: string | null): string[] | undefined => {
  if (!value) return undefined;
  const values = value.split(',').map((v) => v.trim()).filter(Boolean);
  return values.length ? values : undefined;
};

const numberParam = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const params: SearchParams = {
    search: searchParams.get('search') || undefined,
    genres: arrayParam(searchParams.get('genres')),
    excludeGenres: arrayParam(searchParams.get('excludeGenres')),
    year: numberParam(searchParams.get('year')),
    season: searchParams.get('season') || undefined,
    formats: arrayParam(searchParams.get('formats')),
    status: searchParams.get('status') || undefined,
    minScore: numberParam(searchParams.get('minScore')),
    sort: searchParams.get('sort') || undefined,
    page: numberParam(searchParams.get('page')),
    perPage: numberParam(searchParams.get('perPage')),
  };

  try {
    const result = await searchAnime(params);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    const error =
      err instanceof AniListError
        ? err
        : new AniListError('server', 'Catalogue request failed.', String(err));

    return NextResponse.json(
      {
        error: error.viewerMessage,
        kind: error.kind,
        media: [],
        pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false },
      },
      {
        status: error.kind === 'rate' ? 429 : 502,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(error.retryAfter ?? 60) },
      },
    );
  }
}
