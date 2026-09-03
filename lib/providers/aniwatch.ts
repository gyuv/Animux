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

/** Loose comparison: punctuation and case carry no meaning across these sites. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(season|part|cour)\b/g, '')
    .trim();
}

/**
 * Resolve a HiAnime id from the titles AniList knows a show by. Every title
 * variant is tried, and only an exact normalised match counts — HiAnime's
 * search happily returns a spin-off for a season-two query.
 */
export async function aniwatchFindId(titles: (string | null | undefined)[]): Promise<string | null> {
  const base = baseUrl();
  if (!base) return null;

  const candidates = titles.filter(Boolean) as string[];

  for (const title of candidates) {
    const data = (await providerFetch(
      `${base}/api/v2/hianime/search?q=${encodeURIComponent(title)}`,
    ).catch(() => null)) as SearchResponse | null;

    const animes = data?.data?.animes ?? [];
    const wanted = normalise(title);

    const hit = animes.find(
      (a) =>
        a.id &&
        ((a.name && normalise(a.name) === wanted) || (a.jname && normalise(a.jname) === wanted)),
    );

    if (hit?.id) return hit.id;
  }

  return null;
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
