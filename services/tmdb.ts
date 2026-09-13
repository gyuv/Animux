/**
 * TMDB title logos.
 *
 * AniList carries no title-art logo — only text titles and cover/banner
 * artwork — so the stylised wordmark the hero shows above the title comes from
 * The Movie Database, which does. The AniList id is crossed to a TMDB id
 * through the same animeApi cross-reference the MAL fallback uses, then TMDB's
 * images endpoint gives the logo PNG.
 *
 * Entirely optional: without a TMDB_API_KEY, and for any title that cannot be
 * mapped, this returns null and the hero falls back to its text title. Nothing
 * else depends on it.
 */

const MAP_BASE = (process.env.ANIME_ID_MAP_URL || 'https://animeapi.my.id').replace(/\/+$/, '');
const TMDB_KEY = process.env.TMDB_API_KEY;
/** Transparent PNGs, sized for a hero wordmark rather than a poster. */
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

/** The mapping is static and the answer small, so one lookup per id is plenty. */
const logoCache = new Map<number, string | null>();

export function tmdbConfigured(): boolean {
  return Boolean(TMDB_KEY);
}

/** AniList id -> TMDB id, via animeApi. Null when unmapped or unreachable. */
async function anilistToTmdb(anilistId: number): Promise<number | null> {
  try {
    const res = await fetch(`${MAP_BASE}/anilist/${anilistId}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { themoviedb?: number | null };
    return typeof body.themoviedb === 'number' ? body.themoviedb : null;
  } catch {
    return null;
  }
}

/** Pull the best logo file_path from a TMDB images response, or null. */
async function logosFrom(kind: 'tv' | 'movie', tmdbId: number): Promise<string | null> {
  const res = await fetch(
    `https://api.themoviedb.org/3/${kind}/${tmdbId}/images` +
      `?api_key=${TMDB_KEY}&include_image_language=en,ja,null`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } },
  );
  if (!res.ok) return null;

  const body = (await res.json()) as { logos?: { file_path?: string; iso_639_1?: string | null }[] };
  const logos = body.logos ?? [];
  if (logos.length === 0) return null;

  // English wordmark first, then Japanese, then whatever is on file.
  const pick =
    logos.find((l) => l.iso_639_1 === 'en') ??
    logos.find((l) => l.iso_639_1 === 'ja') ??
    logos[0];

  return pick?.file_path ? `${IMG_BASE}${pick.file_path}` : null;
}

/**
 * The title-art logo URL for one AniList id, or null.
 *
 * `isMovie` (from AniList's format) picks which TMDB collection to ask first;
 * the other is tried as a fallback, because the mapping does not always agree
 * with AniList on whether a title is a film or a series.
 */
export async function titleLogo(anilistId: number, isMovie: boolean): Promise<string | null> {
  if (!TMDB_KEY) return null;
  if (logoCache.has(anilistId)) return logoCache.get(anilistId) ?? null;

  const tmdbId = await anilistToTmdb(anilistId);
  if (!tmdbId) {
    logoCache.set(anilistId, null);
    return null;
  }

  const order: ('tv' | 'movie')[] = isMovie ? ['movie', 'tv'] : ['tv', 'movie'];
  let logo: string | null = null;
  for (const kind of order) {
    try {
      logo = await logosFrom(kind, tmdbId);
    } catch {
      logo = null;
    }
    if (logo) break;
  }

  logoCache.set(anilistId, logo);
  return logo;
}
