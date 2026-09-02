import { NextResponse } from 'next/server';
import { searchAnime, AniListError, type SearchParams } from '@/services/anilist';

/**
 * Catalogue proxy.
 *
 * Client components used to call graphql.anilist.co straight from the browser.
 * That meant every viewer's keystroke in the search box became its own
 * uncached request to a rate-limited free API, with no shared cache and no way
 * to coordinate. Routing through here means the whole app's catalogue traffic
 * passes one gate and one cache, and the browser never sees a 403 it cannot
 * explain.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let params: SearchParams;

  try {
    params = (await request.json()) as SearchParams;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  // Clamp anything a client could use to make us expensive.
  params.perPage = Math.min(Math.max(params.perPage ?? 24, 1), 50);
  params.page = Math.min(Math.max(params.page ?? 1, 1), 200);

  try {
    const result = await searchAnime(params);
    return NextResponse.json(result, {
      headers: {
        // Let the CDN absorb repeat traffic and keep serving during an outage.
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    const error = err instanceof AniListError ? err : new AniListError(String(err));

    // Upstream refusing us is not the client's fault, so this is a 503 with a
    // Retry-After the browser can actually act on — never a bare 403 passthrough.
    return NextResponse.json(
      {
        error: error.viewerMessage,
        detail: error.message,
        kind: error.kind,
        media: [],
        pageInfo: { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false },
      },
      {
        status: error.kind === 'query' ? 400 : 503,
        headers: { 'Retry-After': String(error.retryAfter ?? 60) },
      },
    );
  }
}
