import {
  ProviderError, providerFetch,
  type ProviderEpisode, type ProviderEpisodeSources,
} from './types';
import { bestMatch, MAX_QUERIES } from './matching';

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
 * Resolve a HiAnime id from the names AniList knows a show by. Every variant
 * is searched, every result scored, and the best across all of them wins —
 * only if it clears the confidence bar. A page saying "no source" is
 * recoverable; silently playing a different series is not.
 */
export async function aniwatchFindId(titles: (string | null | undefined)[]): Promise<string | null> {
  const base = baseUrl();
  if (!base) return null;

  const candidates = [...new Set(titles.filter(Boolean) as string[])].slice(0, MAX_QUERIES);

  for (const title of candidates) {
    const data = (await providerFetch(
      `${base}/api/v2/hianime/search?q=${encodeURIComponent(title)}`,
    ).catch(() => null)) as SearchResponse | null;

    // Every result is scored against every name we know, not just the one that
    // produced this search — HiAnime's `name` may match AniList's English
    // while its `jname` matches the romaji.
    const id = bestMatch(
      candidates,
      (data?.data?.animes ?? []).map((a) => ({ id: a.id ?? '', names: [a.name, a.jname] })),
    );

    if (id) return id;
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
