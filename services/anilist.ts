/**
 * AniList metadata layer.
 *
 * Everything the app knows about an anime comes through here. Three concerns
 * are handled in one place because they are inseparable in practice:
 *
 *  1. Shape. Two field sets — a light one for the hundreds of cards a browse
 *     page renders, and a full one for the single title page that wants
 *     characters, staff, tags, rankings and score histograms.
 *  2. Rate. AniList is a free API running under a degraded cap, and it bans
 *     IPs that burst. Every outbound call passes the token bucket in
 *     `lib/catalogue/limiter`, so the home page's six shelves queue instead of
 *     stampeding.
 *  3. Failure. A shelf that has ever loaded must never go blank. Successful
 *     responses are kept for a week and served stale — with a notice — when
 *     upstream is refusing us.
 */

import { schedule, backOff, isCoolingDown, cooldownRemaining } from '@/lib/catalogue/limiter';
import { read, write, coalesce } from '@/lib/catalogue/cache';

/** Overridable so the app can be pointed at a mirror, or at a fixture server
 *  during development when AniList's public API is unreachable. */
const ENDPOINT = process.env.ANILIST_ENDPOINT ?? 'https://graphql.anilist.co';

const USER_AGENT =
  process.env.ANILIST_USER_AGENT ??
  'Animux/3.0 (+https://animux.app; contact: support@animux.app)';

/* ------------------------------------------------------------------ types */

export interface AnimeTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

/** The fields every card, rail and grid renders. Deliberately small. */
export interface Anime {
  id: number;
  idMal: number | null;
  title: AnimeTitle;
  description: string | null;
  coverImage: { extraLarge: string | null; large: string | null; color: string | null };
  bannerImage: string | null;
  averageScore: number | null;
  popularity: number | null;
  favourites: number | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  genres: string[];
  studios: { edges: { isMain: boolean; node: { id: number; name: string } }[] };
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
  trailer: { id: string; site: string; thumbnail: string | null } | null;
}

export interface MediaTag {
  id: number;
  name: string;
  description: string | null;
  rank: number | null;
  category: string | null;
  isMediaSpoiler: boolean;
  isGeneralSpoiler: boolean;
}

export interface ExternalLink {
  id: number;
  url: string;
  site: string;
  type: string | null;
  language: string | null;
  color: string | null;
  icon: string | null;
}

export interface StreamingEpisode {
  title: string | null;
  thumbnail: string | null;
  url: string | null;
  site: string | null;
}

export interface CharacterEdge {
  id: number;
  role: string | null;
  node: {
    id: number;
    name: { full: string | null; native: string | null };
    image: { large: string | null };
  };
  voiceActors: {
    id: number;
    name: { full: string | null };
    image: { large: string | null };
    languageV2: string | null;
  }[];
}

export interface StaffEdge {
  id: number;
  role: string | null;
  node: {
    id: number;
    name: { full: string | null };
    image: { large: string | null };
    primaryOccupations: string[] | null;
  };
}

export interface RelationEdge {
  relationType: string | null;
  node: {
    id: number;
    type: string | null;
    format: string | null;
    status: string | null;
    title: AnimeTitle;
    coverImage: { large: string | null; color: string | null };
    seasonYear: number | null;
  };
}

export interface Ranking {
  id: number;
  rank: number;
  type: string;
  format: string | null;
  year: number | null;
  season: string | null;
  allTime: boolean;
  context: string;
}

export interface MediaStats {
  scoreDistribution: { score: number; amount: number }[];
  statusDistribution: { status: string; amount: number }[];
}

/** Everything the title page shows. One request, no waterfalls. */
export interface AnimeDetail extends Anime {
  meanScore: number | null;
  synonyms: string[];
  source: string | null;
  countryOfOrigin: string | null;
  hashtag: string | null;
  startDate: FuzzyDate | null;
  endDate: FuzzyDate | null;
  tags: MediaTag[];
  externalLinks: ExternalLink[];
  streamingEpisodes: StreamingEpisode[];
  rankings: Ranking[];
  stats: MediaStats | null;
  characters: { edges: CharacterEdge[] } | null;
  staff: { edges: StaffEdge[] } | null;
  relations: { edges: RelationEdge[] } | null;
  recommendations: { nodes: { rating: number | null; mediaRecommendation: Anime | null }[] } | null;
}

export interface PageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

export interface AiringEntry {
  id: number;
  episode: number;
  airingAt: number;
  media: Anime;
}

export interface SearchParams {
  search?: string;
  genres?: string[];
  excludeGenres?: string[];
  tags?: string[];
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  season?: string;
  formats?: string[];
  status?: string;
  minScore?: number;
  sort?: string;
  page?: number;
  perPage?: number;
}

/** Attached to every result so the UI can be honest about stale data. */
export interface CatalogueMeta {
  /** Non-null when the payload came from cache during an upstream failure. */
  notice: string | null;
  stale: boolean;
  ageSeconds: number;
}

const FRESH: CatalogueMeta = { notice: null, stale: false, ageSeconds: 0 };

/* ----------------------------------------------------------------- errors */

export type FailureKind = 'network' | 'rate' | 'blocked' | 'server' | 'query';

export class AniListError extends Error {
  readonly kind: FailureKind;
  /** Plain-language line safe to render to a viewer. */
  readonly viewerMessage: string;
  readonly retryAfter: number | null;

  constructor(kind: FailureKind, viewerMessage: string, detail?: string, retryAfter?: number | null) {
    super(detail ?? viewerMessage);
    this.name = 'AniListError';
    this.kind = kind;
    this.viewerMessage = viewerMessage;
    this.retryAfter = retryAfter ?? null;
  }
}

/* ------------------------------------------------------------ field sets */

const CARD_FIELDS = `
  id
  idMal
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large color }
  bannerImage
  averageScore
  popularity
  favourites
  format
  status
  episodes
  duration
  season
  seasonYear
  genres
  studios { edges { isMain node { id name } } }
  nextAiringEpisode { episode airingAt timeUntilAiring }
  trailer { id site thumbnail }
`;

const DETAIL_FIELDS = `
  ${CARD_FIELDS}
  meanScore
  synonyms
  source
  countryOfOrigin
  hashtag
  startDate { year month day }
  endDate { year month day }
  tags { id name description rank category isMediaSpoiler isGeneralSpoiler }
  externalLinks { id url site type language color icon }
  streamingEpisodes { title thumbnail url site }
  rankings { id rank type format year season allTime context }
  stats {
    scoreDistribution { score amount }
    statusDistribution { status amount }
  }
  characters(perPage: 24, sort: [ROLE, RELEVANCE, ID]) {
    edges {
      id
      role
      node { id name { full native } image { large } }
      voiceActors(language: JAPANESE) {
        id
        name { full }
        image { large }
        languageV2
      }
    }
  }
  staff(perPage: 12) {
    edges {
      id
      role
      node { id name { full } image { large } primaryOccupations }
    }
  }
  relations {
    edges {
      relationType(version: 2)
      node {
        id
        type
        format
        status
        title { romaji english native }
        coverImage { large color }
        seasonYear
      }
    }
  }
  recommendations(sort: RATING_DESC, perPage: 14) {
    nodes { rating mediaRecommendation { ${CARD_FIELDS} } }
  }
`;

/* -------------------------------------------------------------- transport */

async function raw<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (isCoolingDown()) {
    throw new AniListError(
      'rate',
      'The catalogue asked us to slow down. Shelves may be a few minutes behind.',
      `self-imposed cooldown, ${cooldownRemaining()}s remaining`,
      cooldownRemaining(),
    );
  }

  let res: Response;
  try {
    res = await schedule(() =>
      fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      }),
    );
  } catch (err) {
    throw new AniListError(
      'network',
      'Could not reach the catalogue.',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
  }

  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after') ?? 60);
    backOff(wait);
    throw new AniListError('rate', 'The catalogue is rate limiting us.', 'HTTP 429', wait);
  }

  if (res.status === 403) {
    // A 403 is either "the public API is off" or "this IP is blocked". Either
    // way the only correct behaviour is to stop sending for a while.
    backOff(300);
    throw new AniListError(
      'blocked',
      'The catalogue is refusing requests right now.',
      'HTTP 403 — see /api/catalogue/health',
      300,
    );
  }

  if (res.status >= 500) {
    backOff(30);
    throw new AniListError('server', 'The catalogue is having trouble.', `HTTP ${res.status}`, 30);
  }

  if (!res.ok) {
    throw new AniListError('server', 'The catalogue returned an error.', `HTTP ${res.status}`);
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new AniListError('server', 'The catalogue sent something unreadable.');

  if (json.errors?.length) {
    const first = json.errors[0];
    const status = Number(first?.status ?? 0);
    if (status === 404) throw new AniListError('query', 'That title is not in the catalogue.', first?.message);
    throw new AniListError('query', 'The catalogue rejected that request.', first?.message);
  }

  return json.data as T;
}

/**
 * Cache-first with a stale floor. A fresh hit returns immediately; a stale hit
 * is refreshed in the background but still served, so a viewer never waits on
 * a slow upstream and never sees an empty shelf because of one.
 */
async function cached<T>(
  key: string,
  ttl: number,
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data: T; meta: CatalogueMeta }> {
  const hit = read<T>(key);
  if (hit?.fresh) return { data: hit.value, meta: FRESH };

  try {
    const data = await coalesce(key, () => raw<T>(query, variables));
    write(key, data, ttl);
    return { data, meta: FRESH };
  } catch (err) {
    const error = err instanceof AniListError ? err : new AniListError('server', 'Catalogue request failed.', String(err));

    if (hit) {
      return {
        data: hit.value,
        meta: {
          notice: `${error.viewerMessage} Showing what we had ${describeAge(hit.ageSeconds)}.`,
          stale: true,
          ageSeconds: hit.ageSeconds,
        },
      };
    }
    throw error;
  }
}

function describeAge(seconds: number): string {
  if (seconds < 120) return 'a moment ago';
  if (seconds < 5400) return `${Math.round(seconds / 60)} minutes ago`;
  if (seconds < 172800) return `${Math.round(seconds / 3600)} hours ago`;
  return `${Math.round(seconds / 86400)} days ago`;
}

/* ------------------------------------------------------------------ search */

const SEARCH_QUERY = `
  query (
    $search: String, $genre_in: [String], $genre_not_in: [String], $tag_in: [String],
    $seasonYear: Int, $season: MediaSeason, $format_in: [MediaFormat],
    $status: MediaStatus, $averageScore_greater: Int,
    $startDate_greater: FuzzyDateInt, $startDate_lesser: FuzzyDateInt,
    $sort: [MediaSort], $page: Int, $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage }
      media(
        search: $search, genre_in: $genre_in, genre_not_in: $genre_not_in, tag_in: $tag_in,
        seasonYear: $seasonYear, season: $season, format_in: $format_in,
        status: $status, averageScore_greater: $averageScore_greater,
        startDate_greater: $startDate_greater, startDate_lesser: $startDate_lesser,
        sort: $sort, type: ANIME, isAdult: false
      ) { ${CARD_FIELDS} }
    }
  }
`;

export async function searchAnime(
  params: SearchParams,
): Promise<{ media: Anime[]; pageInfo: PageInfo; meta: CatalogueMeta }> {
  const variables: Record<string, unknown> = {
    page: Math.min(Math.max(params.page ?? 1, 1), 200),
    perPage: Math.min(Math.max(params.perPage ?? 24, 1), 50),
    sort: [params.sort ?? 'POPULARITY_DESC'],
  };

  if (params.search?.trim()) variables.search = params.search.trim();
  if (params.genres?.length) variables.genre_in = params.genres;
  if (params.excludeGenres?.length) variables.genre_not_in = params.excludeGenres;
  if (params.tags?.length) variables.tag_in = params.tags;
  if (params.year) variables.seasonYear = params.year;
  if (params.season) variables.season = params.season.toUpperCase();
  if (params.formats?.length) variables.format_in = params.formats;
  if (params.status) variables.status = params.status.toUpperCase();
  if (params.minScore) variables.averageScore_greater = params.minScore;
  if (params.yearFrom) variables.startDate_greater = params.yearFrom * 10000;
  if (params.yearTo) variables.startDate_lesser = params.yearTo * 10000 + 1231;

  // Sorting a text search by popularity buries the exact match. AniList's
  // relevance sort only makes sense when there is a query to be relevant to.
  if (variables.search && !params.sort) variables.sort = ['SEARCH_MATCH'];

  const key = `search:${JSON.stringify(variables)}`;
  const { data, meta } = await cached<{ Page: { media: Anime[]; pageInfo: PageInfo } }>(
    key,
    variables.search ? 900 : 3600,
    SEARCH_QUERY,
    variables,
  );

  return { ...data.Page, meta };
}

/* ------------------------------------------------------------------ detail */

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) { ${DETAIL_FIELDS} }
  }
`;

export async function getAnime(id: number): Promise<{ anime: AnimeDetail; meta: CatalogueMeta }> {
  const { data, meta } = await cached<{ Media: AnimeDetail }>(
    `media:${id}`,
    43200,
    DETAIL_QUERY,
    { id },
  );
  return { anime: data.Media, meta };
}

/* ------------------------------------------------------------- bulk lookup */

const BY_IDS_QUERY = `
  query ($ids: [Int]) {
    Page(perPage: 50) {
      media(id_in: $ids, type: ANIME, sort: POPULARITY_DESC) { ${CARD_FIELDS} }
    }
  }
`;

export async function getAnimeByIds(ids: number[]): Promise<{ media: Anime[]; meta: CatalogueMeta }> {
  const clean = [...new Set(ids.filter((n) => Number.isFinite(n)))].slice(0, 50);
  if (clean.length === 0) return { media: [], meta: FRESH };

  try {
    const { data, meta } = await cached<{ Page: { media: Anime[] } }>(
      `ids:${clean.slice().sort((a, b) => a - b).join(',')}`,
      3600,
      BY_IDS_QUERY,
      { ids: clean },
    );
    // Preserve the caller's ordering — the library shows most-recent first.
    const byId = new Map(data.Page.media.map((m) => [m.id, m]));
    return { media: clean.map((id) => byId.get(id)).filter(Boolean) as Anime[], meta };
  } catch (err) {
    const error = err instanceof AniListError ? err : new AniListError('server', 'Catalogue request failed.');
    return { media: [], meta: { notice: error.viewerMessage, stale: false, ageSeconds: 0 } };
  }
}

/* -------------------------------------------------------------------- home */

export interface HomeShelves {
  trending: Anime[];
  seasonal: Anime[];
  upcoming: Anime[];
  allTime: Anime[];
  popular: Anime[];
  movies: Anime[];
}

/**
 * Six shelves, one request. Aliasing `Page` lets AniList answer the whole home
 * page in a single round trip, which matters a great deal when the rate limit
 * is 30/minute and every cold render used to spend four of them.
 */
const HOME_QUERY = `
  query ($season: MediaSeason, $year: Int, $nextSeason: MediaSeason, $nextYear: Int) {
    trending: Page(perPage: 24) {
      media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${CARD_FIELDS} }
    }
    seasonal: Page(perPage: 24) {
      media(season: $season, seasonYear: $year, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${CARD_FIELDS} }
    }
    upcoming: Page(perPage: 24) {
      media(season: $nextSeason, seasonYear: $nextYear, sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${CARD_FIELDS} }
    }
    allTime: Page(perPage: 10) {
      media(sort: SCORE_DESC, type: ANIME, isAdult: false) { ${CARD_FIELDS} }
    }
    popular: Page(perPage: 24) {
      media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${CARD_FIELDS} }
    }
    movies: Page(perPage: 24) {
      media(format: MOVIE, sort: SCORE_DESC, type: ANIME, isAdult: false) { ${CARD_FIELDS} }
    }
  }
`;

export function currentSeason(date = new Date()): { season: string; year: number } {
  const m = date.getMonth();
  const season = m < 3 ? 'WINTER' : m < 6 ? 'SPRING' : m < 9 ? 'SUMMER' : 'FALL';
  return { season, year: date.getFullYear() };
}

export function nextSeason(date = new Date()): { season: string; year: number } {
  const order = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const { season, year } = currentSeason(date);
  const i = order.indexOf(season);
  return i === 3 ? { season: 'WINTER', year: year + 1 } : { season: order[i + 1], year };
}

export async function getHome(): Promise<{ shelves: HomeShelves; meta: CatalogueMeta }> {
  const now = currentSeason();
  const next = nextSeason();

  const { data, meta } = await cached<Record<keyof HomeShelves, { media: Anime[] }>>(
    `home:${now.season}${now.year}`,
    1800,
    HOME_QUERY,
    { season: now.season, year: now.year, nextSeason: next.season, nextYear: next.year },
  );

  return {
    shelves: {
      trending: data.trending?.media ?? [],
      seasonal: data.seasonal?.media ?? [],
      upcoming: data.upcoming?.media ?? [],
      allTime: data.allTime?.media ?? [],
      popular: data.popular?.media ?? [],
      movies: data.movies?.media ?? [],
    },
    meta,
  };
}

/* ---------------------------------------------------------------- schedule */

const SCHEDULE_QUERY = `
  query ($start: Int, $end: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo { hasNextPage }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
        id
        episode
        airingAt
        media { ${CARD_FIELDS} }
      }
    }
  }
`;

/** The week's broadcasts, oldest first. Two pages covers a busy season. */
export async function getSchedule(
  start: number,
  end: number,
): Promise<{ entries: AiringEntry[]; meta: CatalogueMeta }> {
  const collected: AiringEntry[] = [];
  let meta = FRESH;

  for (let page = 1; page <= 3; page += 1) {
    const result = await cached<{
      Page: { pageInfo: { hasNextPage: boolean }; airingSchedules: AiringEntry[] };
    }>(`schedule:${start}:${end}:${page}`, 1800, SCHEDULE_QUERY, { start, end, page });

    if (result.meta.notice) meta = result.meta;
    collected.push(...(result.data.Page.airingSchedules ?? []).filter((e) => e.media && !(e.media as any).isAdult));
    if (!result.data.Page.pageInfo?.hasNextPage) break;
  }

  return { entries: collected, meta };
}

/* -------------------------------------------------------------- constants */

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
  { value: 'FAVOURITES_DESC', label: 'Most loved' },
  { value: 'TITLE_ROMAJI', label: 'A to Z' },
] as const;

export const STATUSES = [
  { value: 'RELEASING', label: 'Airing' },
  { value: 'FINISHED', label: 'Finished' },
  { value: 'NOT_YET_RELEASED', label: 'Announced' },
] as const;

export const SEASONS = [
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
] as const;

export function displayTitle(t: AnimeTitle | undefined | null): string {
  if (!t) return 'Untitled';
  return t.english || t.romaji || t.native || 'Untitled';
}

/** Main studio first; that is the credit a viewer is actually looking for. */
export function mainStudio(anime: Pick<Anime, 'studios'>): string | null {
  const edges = anime.studios?.edges ?? [];
  return (edges.find((e) => e.isMain) ?? edges[0])?.node.name ?? null;
}

export function allStudios(anime: Pick<Anime, 'studios'>): { name: string; isMain: boolean }[] {
  return (anime.studios?.edges ?? []).map((e) => ({ name: e.node.name, isMain: e.isMain }));
}
