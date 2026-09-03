/**
 * Browser-side catalogue client.
 *
 * AniList must not be called directly from the browser. Keeping this small
 * client pointed at our own API means the server-side AniList cache, error
 * handling and rate-limit protection are shared by Home, Browse and Explore.
 */

export interface AnimeQueryParams {
  search?: string;
  genres?: string[];
  excludeGenres?: string[];
  year?: number;
  season?: string;
  formats?: string[];
  status?: string;
  minScore?: number;
  sort?: string;
  page?: number;
  perPage?: number;
}

export interface AnimeSearchResult {
  media: any[];
  pageInfo: {
    total: number;
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
  };
}

const buildQuery = (params: AnimeQueryParams) => {
  const query = new URLSearchParams();

  const add = (key: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  };

  add('search', params.search?.trim());
  add('year', params.year);
  add('season', params.season);
  add('status', params.status);
  add('minScore', params.minScore);
  add('sort', params.sort);
  add('page', params.page ?? 1);
  add('perPage', params.perPage ?? 20);

  if (params.genres?.length) add('genres', params.genres.join(','));
  if (params.excludeGenres?.length) add('excludeGenres', params.excludeGenres.join(','));
  if (params.formats?.length) add('formats', params.formats.join(','));

  return query.toString();
};

export async function fetchAnimeData(params: AnimeQueryParams): Promise<AnimeSearchResult> {
  const response = await fetch(`/api/anime?${buildQuery(params)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  let json: AnimeSearchResult & { error?: string } | null = null;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Catalogue returned ${response.status}.`);
  }

  if (!response.ok) {
    throw new Error(json?.error || `Catalogue returned ${response.status}.`);
  }

  return json as AnimeSearchResult;
}
