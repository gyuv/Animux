/**
 * AniList metadata layer.
 *
 * ---------------------------------------------------------------------------
 * Why the site started returning "The catalogue returned 403"
 * ---------------------------------------------------------------------------
 * A 403 from graphql.anilist.co is not a bug in this codebase. AniList uses it
 * for exactly two things, both upstream of us:
 *
 *   1. The API has been temporarily disabled. AniList does this during outages
 *      and announces it on their Discord. The body carries a GraphQL error
 *      explaining it.
 *   2. Our IP has been blocked for making too many requests. The body carries a
 *      custom message saying so.
 *
 * The previous version made this fatal and unreadable, in three ways:
 *
 *   - It threw on `!res.ok` *before* reading the body, so AniList's actual
 *     explanation was discarded and replaced with the bare status code. Every
 *     cause looked identical.
 *   - It fired four parallel queries on every cold home-page render with no
 *     rate limiting. That traffic shape trips AniList's burst limiter, and
 *     repeatedly tripping it from one IP is what earns case 2 above. The app
 *     was capable of causing its own 403.
 *   - A single failed shelf threw away the whole page, so a thirty-second
 *     upstream blip became a dead site with no way back.
 *
 * This version reads the body first, queues every request through one gate,
 * retries transient failures, serves the last good response when AniList is
 * unreachable, and falls back to a second provider when it stays down.
 */

import { schedule, backOff, cooldownRemaining, isCoolingDown } from '@/lib/catalogue/limiter';
import { read as cacheRead, write as cacheWrite, coalesce } from '@/lib/catalogue/cache';
import { jikanSearch, jikanDetail, rememberMalId } from '@/services/jikan';

const ENDPOINT = 'https://graphql.anilist.co';

/**
 * Cloudflare sits in front of AniList and treats requests with no meaningful
 * User-Agent as bot traffic. Server-side `fetch` in Node sends nothing useful,
 * which is a real and commonly missed cause of a 403 that looks like a block.
 * Identifying the app is also what AniList asks of API consumers.
 */
const USER_AGENT =
  process.env.ANILIST_USER_AGENT ??
  'Animux/2.0 (+https://animux.app; contact: support@animux.app)';

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

/** Where the data on screen actually came from, so the UI can be honest about it. */
export interface Provenance {
  source: 'live' | 'cache' | 'fallback';
  /** Age of the cached copy, when serving one. */
  staleSeconds?: number;
  /** Short line the UI can show the viewer. Null when everything is normal. */
  notice: string | null;
}

export interface SearchResult {
  media: Anime[];
  pageInfo: PageInfo;
  meta: Provenance;
}

const EMPTY_PAGE: PageInfo = { total: 0, currentPage: 1, lastPage: 1, hasNextPage: false };

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

/**
 * Resolving a saved list used to be done one title at a time — up to forty
 * parallel requests from a single browser, straight at AniList, with nothing
 * pacing them. AniList lets us ask for fifty ids in one call, so we do.
 */
const BY_IDS_QUERY = `
  query ($ids: [Int], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(id_in: $ids, type: ANIME) { ${MEDIA_FIELDS} }
    }
  }
`;

/** Why a catalogue call failed, so callers can react instead of guessing. */
export type FailureKind =
  | 'unavailable' // AniList disabled the API
  | 'blocked' // our IP is blocked
  | 'rate-limited' // 429, or our own gate is cooling down
  | 'network' // DNS, TLS, timeout
  | 'query' // our GraphQL is wrong — a real bug on our side
  | 'unknown';

export class AniListError extends Error {
  kind: FailureKind;
  status?: number;
  retryAfter?: number;

  constructor(message: string, kind: FailureKind = 'unknown', status?: number, retryAfter?: number) {
    super(message);
    this.name = 'AniListError';
    this.kind = kind;
    this.status = status;
    this.retryAfter = retryAfter;
  }

  /** A line written for a viewer, not for a log. */
  get viewerMessage(): string {
    switch (this.kind) {
      case 'unavailable':
        return 'AniList has paused its public API. Animux will pick the catalogue back up as soon as it returns.';
      case 'blocked':
        return 'AniList is refusing requests from this server. Nothing is wrong with your connection.';
      case 'rate-limited':
        return 'Animux is being throttled by AniList. It will clear on its own shortly.';
      case 'network':
        return 'Animux could not reach AniList. Check your connection and try again.';
      case 'query':
        return 'Animux asked the catalogue for something it did not understand.';
      default:
        return this.message;
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** AniList's own wording tells us which flavour of 403 we hit. */
function classify403(body: string): FailureKind {
  const text = body.toLowerCase();
  if (text.includes('block')) return 'blocked';
  if (text.includes('disabled') || text.includes('temporarily') || text.includes('stability')) {
    return 'unavailable';
  }
  return 'blocked';
}

/** Extract AniList's message from a body that may or may not be JSON. */
function messageFrom(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw);
    const first = parsed?.errors?.[0]?.message;
    if (typeof first === 'string' && first.trim()) return first.trim();
  } catch {
    /* Cloudflare error pages are HTML, not JSON. */
  }
  return fallback;
}

/** One attempt. Throws AniListError; the retry loop above decides what to do. */
async function attempt<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  let res: Response;

  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
      // We do our own caching; letting Next cache a failure would be worse.
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'TimeoutError';
    throw new AniListError(
      aborted ? 'AniList did not respond in time.' : 'Could not reach AniList.',
      'network',
    );
  }

  // Read the body before deciding anything. This is the line whose absence
  // turned every upstream problem into an opaque "returned 403".
  const raw = await res.text();

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 60);
    backOff(retryAfter);
    throw new AniListError(
      messageFrom(raw, 'AniList is rate limiting this app.'),
      'rate-limited',
      429,
      retryAfter,
    );
  }

  if (res.status === 403) {
    const kind = classify403(raw);
    // A block or a disabled API will not clear in a few seconds. Stop sending.
    backOff(kind === 'blocked' ? 900 : 300);
    throw new AniListError(messageFrom(raw, 'AniList refused the request.'), kind, 403);
  }

  if (res.status >= 500) {
    throw new AniListError(
      messageFrom(raw, `AniList is having server trouble (${res.status}).`),
      'network',
      res.status,
    );
  }

  if (!res.ok) {
    throw new AniListError(messageFrom(raw, `AniList returned ${res.status}.`), 'unknown', res.status);
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new AniListError('AniList returned a response Animux could not read.', 'network');
  }

  if (json.errors?.length) {
    // A 200 with errors is almost always our query being wrong. Retrying
    // an invalid query just burns rate limit, so it is marked non-transient.
    throw new AniListError(json.errors[0]?.message ?? 'AniList rejected the query.', 'query', 200);
  }

  return json.data as T;
}

const TRANSIENT: FailureKind[] = ['network', 'rate-limited'];

/** Attempt, with backoff. Rate-limit waits honour AniList's Retry-After. */
async function withRetry<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const MAX = 3;
  let last: AniListError | null = null;

  for (let i = 0; i < MAX; i += 1) {
    try {
      return await schedule(() => attempt<T>(query, variables));
    } catch (err) {
      last = err instanceof AniListError ? err : new AniListError(String(err));
      if (!TRANSIENT.includes(last.kind)) break;
      if (i === MAX - 1) break;

      const wait = last.retryAfter
        ? last.retryAfter * 1000
        : 700 * 2 ** i + Math.random() * 400; // jitter, so retries don't sync up
      await sleep(wait);
    }
  }

  throw last ?? new AniListError('AniList request failed.');
}

/**
 * The public path. Order of preference:
 *   1. fresh cache
 *   2. live AniList
 *   3. stale cache — a day-old shelf beats an error page
 *   4. the fallback provider
 *   5. an honest, actionable failure
 */
async function resolve<T>(
  key: string,
  ttl: number,
  live: () => Promise<T>,
  fallback?: () => Promise<T | null>,
): Promise<{ value: T; meta: Provenance }> {
  const cached = cacheRead<T>(key);
  if (cached?.fresh) {
    return { value: cached.value, meta: { source: 'cache', notice: null } };
  }

  const serveStaleOrFallback = async (onFail: AniListError): Promise<{ value: T; meta: Provenance }> => {
    const stale = cacheRead<T>(key);
    if (stale) {
      return {
        value: stale.value,
        meta: {
          source: 'cache',
          staleSeconds: stale.ageSeconds,
          notice: 'Showing saved results while AniList is unavailable.',
        },
      };
    }

    if (fallback) {
      const alt = await fallback().catch(() => null);
      if (alt) {
        cacheWrite(key, alt, ttl);
        return {
          value: alt,
          meta: { source: 'fallback', notice: 'AniList is down. Showing a reduced catalogue.' },
        };
      }
    }

    throw onFail;
  };

  // Don't spend a request we know will be refused; go straight to what we have.
  if (isCoolingDown()) {
    return serveStaleOrFallback(
      new AniListError(
        `AniList is not accepting requests. Retrying in ${cooldownRemaining()}s.`,
        'rate-limited',
      ),
    );
  }

  try {
    const value = await coalesce(key, live);
    cacheWrite(key, value, ttl);
    return { value, meta: { source: 'live', notice: null } };
  } catch (err) {
    const error = err instanceof AniListError ? err : new AniListError(String(err));
    if (error.kind === 'query') throw error; // our bug — surface it loudly
    return serveStaleOrFallback(error);
  }
}

function buildVariables(params: SearchParams): Record<string, unknown> {
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

  return variables;
}

export async function searchAnime(params: SearchParams): Promise<SearchResult> {
  const variables = buildVariables(params);
  const key = `search:${JSON.stringify(variables)}`;

  const { value, meta } = await resolve<{ media: Anime[]; pageInfo: PageInfo }>(
    key,
    // Search results churn; shelves don't. Cache the stable ones longer.
    params.search ? 600 : 3600,
    async () => {
      const data = await withRetry<{ Page: { media: Anime[]; pageInfo: PageInfo } }>(
        SEARCH_QUERY,
        variables,
      );
      return data.Page;
    },
    () => jikanSearch(params),
  );

  const media = value.media ?? [];
  // Bank the id pairing so a detail page can still resolve via the fallback
  // provider later, when AniList may no longer be answering.
  if (meta.source === 'live') media.forEach((a) => rememberMalId(a.id, a.idMal));

  return { media, pageInfo: value.pageInfo ?? EMPTY_PAGE, meta };
}

export async function getAnime(id: number) {
  const key = `media:${id}`;
  const { value, meta } = await resolve<Anime & { relations?: any; recommendations?: any }>(
    key,
    86_400,
    async () => {
      const data = await withRetry<{ Media: Anime & { relations: any; recommendations: any } }>(
        DETAIL_QUERY,
        { id },
      );
      return data.Media;
    },
    () => jikanDetail(id),
  );

  if (meta.source === 'live') rememberMalId(value.id, value.idMal);
  return Object.assign(value, { __meta: meta });
}

/**
 * Resolve many titles in one request. Used by the library, where the viewer
 * may have dozens of saved shows and each one is not worth a round trip.
 * Returns whatever resolved; a partially available library beats none.
 */
export async function getAnimeByIds(ids: number[]): Promise<{ media: Anime[]; meta: Provenance }> {
  const clean = [...new Set(ids.filter(Number.isFinite))].slice(0, 50);
  if (clean.length === 0) {
    return { media: [], meta: { source: 'live', notice: null } };
  }

  const key = `ids:${clean.slice().sort((a, b) => a - b).join(',')}`;

  try {
    const { value, meta } = await resolve<{ media: Anime[] }>(key, 3600, async () => {
      const data = await withRetry<{ Page: { media: Anime[] } }>(BY_IDS_QUERY, {
        ids: clean,
        perPage: clean.length,
      });
      return data.Page;
    });

    const media = value.media ?? [];
    if (meta.source === 'live') media.forEach((a) => rememberMalId(a.id, a.idMal));
    return { media, meta };
  } catch (err) {
    const error = err instanceof AniListError ? err : new AniListError(String(err));
    return { media: [], meta: { source: 'live', notice: error.viewerMessage } };
  }
}

/**
 * Never-throws variant, for shelves where an empty row is an acceptable
 * outcome and one dead shelf must not take the page with it.
 */
export async function searchAnimeSafe(params: SearchParams): Promise<SearchResult> {
  try {
    return await searchAnime(params);
  } catch (err) {
    const error = err instanceof AniListError ? err : new AniListError(String(err));
    return {
      media: [],
      pageInfo: EMPTY_PAGE,
      meta: { source: 'live', notice: error.viewerMessage },
    };
  }
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
