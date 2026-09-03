import {
  ProviderError, providerFetch,
  type ProviderEpisode, type ProviderEpisodeSources,
} from './types';

/**
 * Aniwatch (HiAnime) adapter — the fallback when Consumet has nothing.
 *
 * Unlike Consumet's meta routes, this API has no notion of an AniList id, so
 * the mapping has to happen here: search by title, then pick a candidate. That
 * is inherently lossy, so the matching below is deliberately conservative —
 * it would rather return nothing than confidently return the wrong show, and
 * a title page that says "no source" is recoverable in a way that silently
 * playing a different series is not.
 */

function baseUrl(): string | null {
  const raw = process.env.ANIWATCH_API_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export function aniwatchConfigured(): boolean {
  return baseUrl() !== null;
}

export type AniwatchCategory = 'sub' | 'dub';

interface SearchResponse {
  data?: { animes?: { id?: string; name?: string; jname?: string; episodes?: { sub?: number } }[] };
}

interface EpisodesResponse {
  data?: { episodes?: { episodeId?: string; number?: number; title?: string; isFiller?: boolean }[] };
}

interface SourcesResponse {
  data?: {
    headers?: Record<string, string>;
    sources?: { url?: string; type?: string; quality?: string }[];
    tracks?: { file?: string; label?: string; kind?: string; default?: boolean }[];
    intro?: { start?: number; end?: number };
    outro?: { start?: number; end?: number };
  };
}

/**
 * Ordinals as these catalogues actually write them. A season number is the one
 * part of a title that must survive normalising intact, so every spelling of
 * it collapses to the same digit — "2nd", "second" and "II" are the same
 * season, and none of them is season one.
 */
const ORDINALS: Record<string, string> = {
  '1st': '1', first: '1', i: '1',
  '2nd': '2', second: '2', ii: '2',
  '3rd': '3', third: '3', iii: '3',
  '4th': '4', fourth: '4', iv: '4',
  '5th': '5', fifth: '5', v: '5',
  '6th': '6', sixth: '6', vi: '6',
};

/** Loose comparison: punctuation and case carry no meaning across these sites. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    // "Season", "Part" and "Cour" are noise; the number beside them is not.
    .filter((token) => !['season', 'part', 'cour'].includes(token))
    .map((token) => ORDINALS[token] ?? token)
    .join(' ')
    .trim();
}

/**
 * Resolve a HiAnime id from the titles AniList knows a show by. Every title
 * variant is tried, and only an exact normalised match counts — HiAnime's
 * search happily returns a spin-off for a season-two query.
 */
function tokens(value: string): string[] {
  return normalise(value).split(' ').filter(Boolean);
}

/**
 * How confident we are that two titles name the same show, 0–1.
 *
 * Exact equality after normalising is the easy case. The hard one is that
 * these two catalogues frequently spell a show differently — AniList's romaji
 * against HiAnime's localised name — so a pure equality test rejects most real
 * titles and the viewer gets "no source" for a show that is plainly there.
 * Trying every name AniList knows and scoring the overlap covers that.
 *
 * The ordinal guard is the important part: a season or part number present on
 * one side and absent or different on the other is a *different season*, not a
 * near miss, and confidently serving season one to someone who asked for
 * season three is worse than serving nothing.
 */
function similarity(a: string, b: string): number {
  const left = normalise(a);
  const right = normalise(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const ta = tokens(a);
  const tb = tokens(b);

  const ordinals = (list: string[]) => list.filter((t) => /^\d+$/.test(t)).join(',');
  if (ordinals(ta) !== ordinals(tb)) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let shared = 0;
  for (const token of setA) if (setB.has(token)) shared += 1;
  const dice = (2 * shared) / (setA.size + setB.size);

  // "Frieren" against "Frieren Beyond Journey's End" is the same show under a
  // shorter name, which token overlap alone scores too harshly.
  const contained = left.includes(right) || right.includes(left);
  return contained ? Math.max(dice, 0.85) : dice;
}

/** Below this, treat it as no match rather than guess. */
const CONFIDENCE = 0.72;

/** How many of AniList's names to spend a search request on. */
const MAX_QUERIES = 3;

/**
 * Resolve a HiAnime id from the names AniList knows a show by. Every variant
 * is searched, every result scored, and the best across all of them wins —
 * only if it clears the confidence bar. A page saying "no source" is
 * recoverable; silently playing a different series is not.
 */
export async function aniwatchFindId(titles: (string | null | undefined)[]): Promise<string | null> {
  const base = baseUrl();
  if (!base) return null;

  const candidates = [...new Set(titles.filter(Boolean) as string[])].slice(0, MAX_QUERIES);

  let best: { id: string; score: number } | null = null;

  for (const title of candidates) {
    const data = (await providerFetch(
      `${base}/api/v2/hianime/search?q=${encodeURIComponent(title)}`,
    ).catch(() => null)) as SearchResponse | null;

    for (const anime of data?.data?.animes ?? []) {
      if (!anime.id) continue;

      // Score every result against every name we know, not just the one that
      // produced this search — HiAnime's `name` may match AniList's English
      // while its `jname` matches the romaji.
      const score = Math.max(
        ...candidates.flatMap((candidate) => [
          anime.name ? similarity(candidate, anime.name) : 0,
          anime.jname ? similarity(candidate, anime.jname) : 0,
        ]),
      );

      if (!best || score > best.score) best = { id: anime.id, score };
    }

    // An exact hit cannot be improved on, so stop spending requests.
    if (best?.score === 1) break;
  }

  return best && best.score >= CONFIDENCE ? best.id : null;
}

export async function aniwatchEpisodes(animeId: string): Promise<ProviderEpisode[]> {
  const base = baseUrl();
  if (!base) throw new ProviderError('No streaming provider is configured.');

  const data = (await providerFetch(
    `${base}/api/v2/hianime/anime/${encodeURIComponent(animeId)}/episodes`,
  )) as EpisodesResponse;

  const episodes = (data.data?.episodes ?? [])
    .filter((e) => e.episodeId)
    .map((e, i) => ({
      id: e.episodeId as string,
      number: Number.isFinite(e.number) ? Number(e.number) : i + 1,
      title: e.title ?? null,
      // HiAnime's episode listing carries no artwork; the title page falls
      // back to AniList's, then to the numbered panel.
      image: null,
      description: null,
      isFiller: Boolean(e.isFiller),
    }));

  if (episodes.length === 0) {
    throw new ProviderError('This source has no episodes for that title.');
  }

  return episodes.sort((a, b) => a.number - b.number);
}

export async function aniwatchSources(
  episodeId: string,
  category: AniwatchCategory,
  server?: string,
): Promise<ProviderEpisodeSources> {
  const base = baseUrl();
  if (!base) throw new ProviderError('No streaming provider is configured.');

  const params = new URLSearchParams({ animeEpisodeId: episodeId, category });
  if (server) params.set('server', server);

  const data = (await providerFetch(
    `${base}/api/v2/hianime/episode/sources?${params.toString()}`,
  )) as SourcesResponse;

  const payload = data.data;
  const sources = (payload?.sources ?? [])
    .filter((s) => s.url)
    .map((s) => ({
      url: s.url as string,
      quality: s.quality ?? 'auto',
      isM3U8: s.type === 'hls' || /\.m3u8(\?|$)/i.test(s.url as string),
    }));

  if (sources.length === 0) {
    throw new ProviderError('That episode returned no playable source.');
  }

  return {
    sources,
    subtitles: (payload?.tracks ?? [])
      .filter((t) => t.file && t.kind === 'captions' && t.label)
      .map((t) => ({ url: t.file as string, lang: t.label as string })),
    intro: span(payload?.intro),
    outro: span(payload?.outro),
    referer: payload?.headers?.Referer ?? payload?.headers?.referer,
  };
}

function span(value?: { start?: number; end?: number }) {
  if (!value) return undefined;
  const start = Number(value.start ?? 0);
  const end = Number(value.end ?? 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return { start, end };
}
