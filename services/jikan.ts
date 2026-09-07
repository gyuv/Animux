import type { Anime, HomeShelves } from './anilist';

/**
 * Jikan — the unofficial MyAnimeList API (https://jikan.moe).
 *
 * This exists for one reason: when AniList refuses us, the site currently has
 * nothing to show and renders "The catalogue is not answering". AniList
 * answers 429 when we go over its limit and 403 when it has decided to block
 * the address outright, and on a shared serverless IP that is not rare. A
 * second, unrelated catalogue means an AniList outage costs freshness rather
 * than the whole listing.
 *
 * It is a *fallback*, never the primary. AniList is the app's native id space:
 * every streaming source here is keyed by AniList id, so a MAL id cannot be
 * used to play anything until it has been mapped back. See `malToAnilist`.
 */

const BASE = (process.env.JIKAN_API_URL || 'https://api.jikan.moe/v4').replace(/\/+$/, '');

/**
 * Jikan documents 3 requests/second and 60/minute, and answers 429 when you
 * exceed it. The shelves below are fetched in sequence rather than in
 * parallel for exactly that reason — a burst of six is the shape that trips
 * it, and this path only runs when the primary catalogue is already failing.
 */
const GAP_MS = 400;
let lastCall = 0;

async function paced<T>(job: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, lastCall + GAP_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return job();
}

export class JikanError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = 'JikanError';
  }
}

interface JikanAnime {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
  score?: number | null;
  members?: number | null;
  favorites?: number | null;
  type?: string | null;
  status?: string | null;
  episodes?: number | null;
  duration?: string | null;
  season?: string | null;
  year?: number | null;
  genres?: { name?: string }[];
  studios?: { mal_id?: number; name?: string }[];
  trailer?: { youtube_id?: string | null } | null;
}

async function get(path: string, timeoutMs = 12_000): Promise<{ data?: JikanAnime[] }> {
  let res: Response;
  try {
    res = await paced(() => fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      // Never 'no-store': that would opt the page out of static rendering.
      next: { revalidate: 1800 },
    }));
  } catch (err) {
    throw new JikanError(
      'The backup catalogue is not answering.',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
  }

  if (res.status === 429) throw new JikanError('The backup catalogue is rate limiting us.', 'HTTP 429');
  if (!res.ok) throw new JikanError('The backup catalogue returned an error.', `HTTP ${res.status}`);

  const json = await res.json().catch(() => null);
  if (!json) throw new JikanError('The backup catalogue sent something unreadable.');
  return json as { data?: JikanAnime[] };
}

/* --------------------------------------------------------------- mapping */

/** Jikan writes formats in title case; the rest of the app expects AniList's. */
function toFormat(type: string | null | undefined): string | null {
  if (!type) return null;
  const key = type.trim().toUpperCase();
  return key === 'MUSIC' ? 'MUSIC' : key;
}

function toStatus(status: string | null | undefined): string | null {
  const key = (status ?? '').toLowerCase();
  if (key.includes('currently')) return 'RELEASING';
  if (key.includes('finished')) return 'FINISHED';
  if (key.includes('not yet')) return 'NOT_YET_RELEASED';
  return null;
}

/** "24 min per ep" — the number is the only part worth keeping. */
function toMinutes(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const hours = /(\d+)\s*hr/.exec(duration);
  const mins = /(\d+)\s*min/.exec(duration);
  const total = (hours ? Number(hours[1]) * 60 : 0) + (mins ? Number(mins[1]) : 0);
  return total > 0 ? total : null;
}

/**
 * A MAL entry in the app's own shape.
 *
 * The id is negative on purpose. Every card in the app links to
 * `/title/{id}`, and a MAL id in that slot would silently open a *different*
 * show — MAL 5114 and AniList 5114 are unrelated titles. Negating it makes the
 * two id spaces impossible to confuse, keeps every card component unchanged,
 * and gives `/title/[id]` a single unambiguous signal to map the id back
 * before rendering anything. It is never a valid AniList id, so nothing can
 * mistake it for one.
 */
function toAnime(raw: JikanAnime): Anime {
  const cover = raw.images?.jpg?.large_image_url ?? raw.images?.jpg?.image_url ?? null;

  return {
    id: -raw.mal_id,
    idMal: raw.mal_id,
    title: {
      romaji: raw.title ?? null,
      english: raw.title_english ?? null,
      native: raw.title_japanese ?? null,
    },
    description: raw.synopsis ?? null,
    coverImage: { extraLarge: cover, large: cover, color: null },
    bannerImage: null,
    // MAL scores are out of 10; the app's scale, like AniList's, is out of 100.
    averageScore: typeof raw.score === 'number' ? Math.round(raw.score * 10) : null,
    popularity: raw.members ?? null,
    favourites: raw.favorites ?? null,
    format: toFormat(raw.type),
    status: toStatus(raw.status),
    episodes: raw.episodes ?? null,
    duration: toMinutes(raw.duration),
    season: raw.season ? raw.season.toUpperCase() : null,
    seasonYear: raw.year ?? null,
    genres: (raw.genres ?? []).map((g) => g.name).filter(Boolean) as string[],
    studios: {
      edges: (raw.studios ?? []).map((s) => ({
        isMain: true,
        node: { id: s.mal_id ?? 0, name: s.name ?? 'Unknown' },
      })),
    },
    // Jikan's schedule lives on a different endpoint and this is a degraded
    // path; a missing countdown is better than a wrong one.
    nextAiringEpisode: null,
    trailer: raw.trailer?.youtube_id
      ? { id: raw.trailer.youtube_id, site: 'youtube', thumbnail: null }
      : null,
  };
}

/* ---------------------------------------------------------------- shelves */

/**
 * The home shelves, from MAL. Sequential by design — see the pacing note
 * above. Any shelf that fails comes back empty rather than taking the page
 * down with it, because a partial listing is worth far more here than none.
 */
export async function jikanHome(): Promise<HomeShelves> {
  const shelf = async (path: string): Promise<Anime[]> => {
    try {
      const { data } = await get(path);
      return (data ?? []).map(toAnime);
    } catch {
      return [];
    }
  };

  const trending = await shelf('/top/anime?filter=airing&limit=24');
  const seasonal = await shelf('/seasons/now?limit=24');
  const upcoming = await shelf('/seasons/upcoming?limit=24');
  const allTime = await shelf('/top/anime?limit=10');
  const popular = await shelf('/top/anime?filter=bypopularity&limit=24');
  const movies = await shelf('/top/anime?type=movie&limit=24');

  // If every shelf came back empty the fallback has not fallen back to
  // anything, and saying so is better than rendering a page of blank rails.
  if (![trending, seasonal, upcoming, allTime, popular, movies].some((s) => s.length > 0)) {
    throw new JikanError('The backup catalogue returned nothing.');
  }

  return { trending, seasonal, upcoming, allTime, popular, movies };
}

/** Titles matching a query, for search while AniList is unavailable. */
export async function jikanSearch(query: string, limit = 24): Promise<Anime[]> {
  const { data } = await get(`/anime?q=${encodeURIComponent(query)}&limit=${limit}&sfw=true`);
  return (data ?? []).map(toAnime);
}

/* ---------------------------------------------------------------- mapping */

const MAP_BASE = (process.env.ANIME_ID_MAP_URL || 'https://animeapi.my.id').replace(/\/+$/, '');

/** MAL id -> AniList id, memoised: the mapping is static, so once is enough. */
const mapped = new Map<number, number | null>();

/**
 * Turn a MAL id into the AniList id the rest of the app is built on.
 *
 * Uses nattadasu/animeApi, which publishes exactly this cross-reference. The
 * full dump is 32MB, so it is queried one id at a time — which is affordable
 * because this runs when a viewer opens a title, not when a shelf renders.
 */
export async function malToAnilist(malId: number): Promise<number | null> {
  if (mapped.has(malId)) return mapped.get(malId) ?? null;

  try {
    const res = await fetch(`${MAP_BASE}/myanimelist/${malId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      // The MAL->AniList cross-reference is effectively immutable.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      mapped.set(malId, null);
      return null;
    }
    const body = (await res.json()) as { anilist?: number | null };
    const id = typeof body.anilist === 'number' ? body.anilist : null;
    mapped.set(malId, id);
    return id;
  } catch {
    // Not cached as a miss: an unreachable mapper is a transient condition,
    // and caching it would keep the title unopenable after it recovers.
    return null;
  }
}
