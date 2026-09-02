/**
 * Browser-side catalogue access.
 *
 * This used to POST to graphql.anilist.co directly from the client and, on any
 * failure, `return { media: [] }`. That is the worst possible shape for an
 * error: "AniList has blocked us" and "no anime matched your search" arrived at
 * the UI as the same value, so the interface confidently rendered "no results"
 * during a total outage.
 *
 * Now it goes through /api/catalogue, which shares one rate limiter and one
 * cache with the server-rendered pages, and failures come back as failures.
 */

export interface AnimeQueryParams {
  search?: string;
  genres?: string[];
  excludeGenres?: string[];
  status?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  year?: number;
  season?: string;
  formats?: string[];
  minScore?: number;
}

export interface CatalogueResponse {
  media: any[];
  pageInfo: {
    total: number;
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
  };
  /** Set when results are stale or from the fallback provider. */
  notice?: string | null;
}

export class CatalogueUnavailable extends Error {
  kind: string;
  retryAfter: number;

  constructor(message: string, kind = 'unknown', retryAfter = 60) {
    super(message);
    this.name = 'CatalogueUnavailable';
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

export async function fetchAnimeData(
  params: AnimeQueryParams,
  signal?: AbortSignal,
): Promise<CatalogueResponse> {
  let res: Response;

  try {
    res = await fetch('/api/catalogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    });
  } catch (err) {
    // An aborted request is the caller changing its mind, not a failure.
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new CatalogueUnavailable('Animux could not reach its server.', 'network');
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new CatalogueUnavailable(
      json?.error ?? 'The catalogue is unavailable.',
      json?.kind ?? 'unknown',
      Number(res.headers.get('Retry-After') ?? 60),
    );
  }

  return {
    media: json?.media ?? [],
    pageInfo: json?.pageInfo ?? { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false },
    notice: json?.meta?.notice ?? null,
  };
}
