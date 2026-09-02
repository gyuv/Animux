/**
 * Fallback catalogue: Jikan, the open MyAnimeList API.
 *
 * This exists so that "AniList is down" degrades into a thinner catalogue
 * rather than a dead site. It is deliberately second-class — Jikan has no
 * dominant-artwork colour, so the chroma system falls back to neutral, and its
 * filtering is coarser than AniList's. That is the right trade: a viewer during
 * an outage wants something to watch, not feature parity.
 *
 * Jikan asks for no more than 3 requests/second and 60/minute, and it is run by
 * volunteers, so this module keeps a hard gap between calls and is only ever
 * reached when the primary provider has already failed.
 */

import type { Anime, PageInfo, SearchParams } from '@/services/anilist';

const BASE = 'https://api.jikan.moe/v4';
const MIN_GAP_MS = 400;

let lastCall = 0;

async function gated<T>(path: string): Promise<T | null> {
  const wait = Math.max(0, lastCall + MIN_GAP_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * AniList IDs and MyAnimeList IDs are different numbering schemes, so a
 * detail-page fallback needs a bridge between them. Every AniList record we
 * successfully fetch carries `idMal`, so we record the pairing as we go and
 * use it if AniList later becomes unreachable.
 */
const malIdByAniListId = new Map<number, number>();

export function rememberMalId(anilistId: number, malId: number | null | undefined) {
  if (malId) malIdByAniListId.set(anilistId, malId);
}

const STATUS: Record<string, string> = {
  'Currently Airing': 'RELEASING',
  'Finished Airing': 'FINISHED',
  'Not yet aired': 'NOT_YET_RELEASED',
};

const FORMAT: Record<string, string> = {
  TV: 'TV',
  Movie: 'MOVIE',
  OVA: 'OVA',
  ONA: 'ONA',
  Special: 'SPECIAL',
  Music: 'MUSIC',
};

/** MAL uses numeric genre IDs where AniList uses names. */
const GENRE_ID: Record<string, number> = {
  Action: 1, Adventure: 2, Comedy: 4, Drama: 8, Ecchi: 9, Fantasy: 10,
  Horror: 14, 'Mahou Shoujo': 66, Mecha: 18, Music: 19, Mystery: 7,
  Psychological: 40, Romance: 22, 'Sci-Fi': 24, 'Slice of Life': 36,
  Sports: 30, Supernatural: 37, Thriller: 41,
};

/** "24 min per ep" -> 24 */
function minutes(duration?: string | null): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)\s*min/i);
  return match ? Number(match[1]) : null;
}

function toAnime(raw: any): Anime {
  const anime: Anime = {
    // Jikan only knows MAL IDs. Routes keyed on this id will resolve through
    // the bridge above once AniList is back.
    id: raw.mal_id,
    idMal: raw.mal_id ?? null,
    title: {
      romaji: raw.title ?? null,
      english: raw.title_english ?? null,
      native: raw.title_japanese ?? null,
    },
    description: raw.synopsis ?? null,
    coverImage: {
      extraLarge: raw.images?.jpg?.large_image_url ?? null,
      large: raw.images?.jpg?.image_url ?? null,
      // No dominant colour from MAL; the chroma system handles null.
      color: null,
    },
    bannerImage: null,
    averageScore: raw.score ? Math.round(raw.score * 10) : null,
    popularity: raw.members ?? null,
    format: FORMAT[raw.type] ?? raw.type ?? null,
    status: STATUS[raw.status] ?? null,
    episodes: raw.episodes ?? null,
    duration: minutes(raw.duration),
    season: raw.season ? String(raw.season).toUpperCase() : null,
    seasonYear: raw.year ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres.map((g: any) => g.name) : [],
    studios: {
      nodes: Array.isArray(raw.studios) ? raw.studios.map((s: any) => ({ name: s.name })) : [],
    },
    nextAiringEpisode: null,
    trailer: raw.trailer?.youtube_id ? { id: raw.trailer.youtube_id, site: 'youtube' } : null,
  };
  return anime;
}

function toQuery(params: SearchParams): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page ?? 1));
  q.set('limit', String(Math.min(25, params.perPage ?? 24))); // Jikan caps at 25
  q.set('sfw', 'true');

  if (params.search?.trim()) q.set('q', params.search.trim());

  switch (params.sort) {
    case 'SCORE_DESC':
      q.set('order_by', 'score');
      q.set('sort', 'desc');
      break;
    case 'START_DATE_DESC':
      q.set('order_by', 'start_date');
      q.set('sort', 'desc');
      break;
    case 'TITLE_ROMAJI':
      q.set('order_by', 'title');
      q.set('sort', 'asc');
      break;
    // Jikan has no trending signal; member count is the closest proxy.
    default:
      q.set('order_by', 'members');
      q.set('sort', 'desc');
  }

  if (params.status === 'RELEASING') q.set('status', 'airing');
  if (params.status === 'FINISHED') q.set('status', 'complete');
  if (params.status === 'NOT_YET_RELEASED') q.set('status', 'upcoming');

  if (params.minScore) q.set('min_score', String(params.minScore / 10));
  if (params.year) q.set('start_date', `${params.year}-01-01`);

  const ids = (params.genres ?? []).map((g) => GENRE_ID[g]).filter(Boolean);
  if (ids.length) q.set('genres', ids.join(','));

  const excluded = (params.excludeGenres ?? []).map((g) => GENRE_ID[g]).filter(Boolean);
  if (excluded.length) q.set('genres_exclude', excluded.join(','));

  return q.toString();
}

export async function jikanSearch(
  params: SearchParams,
): Promise<{ media: Anime[]; pageInfo: PageInfo } | null> {
  const json = await gated<any>(`/anime?${toQuery(params)}`);
  if (!json?.data) return null;

  const media = json.data.map(toAnime);
  const pagination = json.pagination ?? {};

  return {
    media,
    pageInfo: {
      total: pagination.items?.total ?? media.length,
      currentPage: pagination.current_page ?? params.page ?? 1,
      lastPage: pagination.last_visible_page ?? 1,
      hasNextPage: Boolean(pagination.has_next_page),
    },
  };
}

export async function jikanDetail(anilistId: number): Promise<Anime | null> {
  const malId = malIdByAniListId.get(anilistId) ?? anilistId;
  const json = await gated<any>(`/anime/${malId}/full`);
  if (!json?.data) return null;
  return toAnime(json.data);
}
