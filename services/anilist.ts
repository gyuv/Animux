/**
 * AniList metadata layer.
 *
 * Fixes carried over from the previous version:
 *  - `description` was never requested, so the hero's synopsis was always
 *    undefined and silently fell back to placeholder marketing copy.
 *  - Only a single `status` value could be applied, and genres could not be
 *    excluded, which made the "advanced" search barely more than a text box.
 *  - Failures returned an empty page indistinguishable from "no results",
 *    so the UI could not tell a network problem from an empty shelf.
 */

const ENDPOINT = 'https://graphql.anilist.co';

export interface AnimeTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface Anime {
  id: number;
  idMal: number | null;
  title: AnimeTitle;
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  averageScore: number | null;
  popularity: number | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  genres: string[];
  studios: { nodes: { name: string }[] };
  nextAiringEpisode: { episode: number; timeUntilAiring: number } | null;
  trailer: { id: string; site: string } | null;
}

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface SearchParams {
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

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  popularity
  format
  status
  episodes
  duration
  season
  seasonYear
  genres
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode timeUntilAiring }
  trailer { id site }
`;

const SEARCH_QUERY = `
  query (
    $search: String, $genre_in: [String], $genre_not_in: [String],
    $seasonYear: Int, $season: MediaSeason, $format_in: [MediaFormat],
    $status: MediaStatus, $averageScore_greater: Int,
    $sort: [MediaSort], $page: Int, $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage }
      media(
        search: $search, genre_in: $genre_in, genre_not_in: $genre_not_in,
        seasonYear: $seasonYear, season: $season, format_in: $format_in,
        status: $status, averageScore_greater: $averageScore_greater,
        sort: $sort, type: ANIME, isAdult: false
      ) { ${MEDIA_FIELDS} }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${MEDIA_FIELDS}
      bannerImage
      relations {
        edges {
          relationType(version: 2)
          node { id type title { romaji english } coverImage { large color } format }
        }
      }
      recommendations(sort: RATING_DESC, perPage: 12) {
        nodes { mediaRecommendation { ${MEDIA_FIELDS} } }
      }
    }
  }
`;

export class AniListError extends Error {}

// Prevent a burst of identical requests when several shelves/components render
// together. This is intentionally process-local; Next's fetch cache remains the
// durable cache layer across requests/deployments.
const inFlight = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gql<T>(query: string, variables: Record<string, unknown>, revalidate = 3600): Promise<T> {
  const key = JSON.stringify([query, variables]);
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        // Explicit caching is important here: catalogue data changes much less
        // frequently than the UI renders it.
        next: { revalidate },
      });
    } catch {
      throw new AniListError('Could not reach the catalogue. Check your connection.');
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after'));
      // AniList normally supplies Retry-After. Cap the wait so a broken header
      // can never leave a server request hanging indefinitely.
      const waitSeconds = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter, 15)
        : 3;
      await sleep(waitSeconds * 1000);

      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ query, variables }),
          next: { revalidate },
        });
      } catch {
        throw new AniListError('Could not reach the catalogue. Check your connection.');
      }

      if (res.status === 429) {
        throw new AniListError('The catalogue is rate limiting us. Try again in a moment.');
      }
    }

    if (!res.ok) {
      throw new AniListError(`The catalogue returned ${res.status}.`);
    }

    const json = await res.json();
    if (json.errors?.length) {
      throw new AniListError(json.errors[0]?.message ?? 'The catalogue rejected that request.');
    }
    return json.data as T;
  })();

  inFlight.set(key, request);
  try {
    return await request as T;
  } finally {
    inFlight.delete(key);
  }
}

export async function searchAnime(
  params: SearchParams,
): Promise<{ media: Anime[]; pageInfo: PageInfo }> {
  const variables: Record<string, unknown> = {
    page: params.page ?? 1,
    perPage: params.perPage ?? 24,
    sort: [params.sort ?? 'POPULARITY_DESC'],
  };

  if (params.search?.trim()) variables.search = params.search.trim();
  if (params.genres?.length) variables.genre_in = params.genres;
  if (params.excludeGenres?.length) variables.genre_not_in = params.excludeGenres;
  if (params.year) variables.seasonYear = params.year;
  if (params.season) variables.season = params.season.toUpperCase();
  if (params.formats?.length) variables.format_in = params.formats;
  if (params.status) variables.status = params.status.toUpperCase();
  if (params.minScore) variables.averageScore_greater = params.minScore;

  // A text search sorted by popularity buries exact matches; AniList's
  // relevance sort only makes sense when there is a query to be relevant to.
  if (variables.search && !params.sort) variables.sort = ['SEARCH_MATCH'];

  const data = await gql<{ Page: { media: Anime[]; pageInfo: PageInfo } }>(SEARCH_QUERY, variables);
  return data.Page;
}

export async function getAnime(id: number) {
  const data = await gql<{ Media: Anime & { relations: any; recommendations: any } }>(
    DETAIL_QUERY,
    { id },
    86400,
  );
  return data.Media;
}

export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
  'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance',
  'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
] as const;

export const FORMATS = [
  { value: 'TV', label: 'TV series' },
  { value: 'TV_SHORT', label: 'Short' },
  { value: 'MOVIE', label: 'Film' },
  { value: 'OVA', label: 'OVA' },
  { value: 'ONA', label: 'ONA' },
  { value: 'SPECIAL', label: 'Special' },
] as const;

export const SORTS = [
  { value: 'POPULARITY_DESC', label: 'Most watched' },
  { value: 'SCORE_DESC', label: 'Highest rated' },
  { value: 'TRENDING_DESC', label: 'Trending now' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'TITLE_ROMAJI', label: 'A to Z' },
] as const;

export const STATUSES = [
  { value: 'RELEASING', label: 'Airing' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'NOT_YET_RELEASED', label: 'Announced' },
] as const;

export function displayTitle(t: AnimeTitle): string {
  return t.english || t.romaji || t.native || 'Untitled';
}
