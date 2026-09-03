import {
  ProviderError, providerFetch, toLangCode,
  type ProviderEpisode, type ProviderEpisodeSources,
} from './types';

/**
 * Consumet adapter.
 *
 * Critically this uses the `/meta/anilist/` routes rather than
 * `/anime/gogoanime/`. Both exist, but the gogoanime routes are keyed by the
 * provider's own slug ("one-piece"), which would leave us to map an AniList id
 * onto a slug by fuzzy title search — the single biggest source of "it plays
 * the wrong show" in every app built on these APIs. The meta routes take the
 * AniList id directly and do that mapping upstream, where it is at least done
 * once and consistently.
 *
 * They also return per-episode `image` and `title`, which is a far better
 * source of episode artwork than AniList's own `streamingEpisodes` field.
 */

function baseUrl(): string | null {
  const raw = process.env.CONSUMET_API_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export function consumetConfigured(): boolean {
  return baseUrl() !== null;
}

/** gogoanime is the broadest catalogue; zoro carries more dubs and subtitles. */
export type ConsumetProvider = 'gogoanime' | 'zoro';

export const CONSUMET_PROVIDERS: ConsumetProvider[] = ['gogoanime', 'zoro'];

interface MetaInfoResponse {
  episodes?: {
    id?: string;
    number?: number;
    title?: string | null;
    image?: string | null;
    description?: string | null;
  }[];
}

interface WatchResponse {
  headers?: Record<string, string>;
  sources?: { url?: string; quality?: string; isM3U8?: boolean }[];
  subtitles?: { url?: string; lang?: string }[];
  intro?: { start?: number; end?: number };
  outro?: { start?: number; end?: number };
}

/** Episode list for an AniList id, with the provider's episode ids attached. */
export async function consumetEpisodes(
  anilistId: number,
  provider: ConsumetProvider,
): Promise<ProviderEpisode[]> {
  const base = baseUrl();
  if (!base) throw new ProviderError('No streaming provider is configured.');

  const data = (await providerFetch(
    `${base}/meta/anilist/info/${anilistId}?provider=${provider}`,
    20_000, // the first call for a title makes Consumet do its own mapping
  )) as MetaInfoResponse;

  const episodes = (data.episodes ?? [])
    .filter((e) => e.id)
    .map((e, i) => ({
      id: e.id as string,
      number: Number.isFinite(e.number) ? Number(e.number) : i + 1,
      title: e.title ?? null,
      image: e.image ?? null,
      description: e.description ?? null,
    }));

  if (episodes.length === 0) {
    throw new ProviderError('This source has no episodes for that title.');
  }

  return episodes.sort((a, b) => a.number - b.number);
}

/** Playable sources for one of those episode ids. */
export async function consumetSources(
  episodeId: string,
  provider: ConsumetProvider,
): Promise<ProviderEpisodeSources> {
  const base = baseUrl();
  if (!base) throw new ProviderError('No streaming provider is configured.');

  const data = (await providerFetch(
    `${base}/meta/anilist/watch/${encodeURIComponent(episodeId)}?provider=${provider}`,
  )) as WatchResponse;

  const sources = (data.sources ?? [])
    .filter((s) => s.url)
    .map((s) => ({
      url: s.url as string,
      quality: s.quality ?? 'auto',
      // Consumet omits isM3U8 on some providers, so fall back to the extension.
      isM3U8: s.isM3U8 ?? /\.m3u8(\?|$)/i.test(s.url as string),
    }));

  if (sources.length === 0) {
    throw new ProviderError('That episode returned no playable source.');
  }

  return {
    sources,
    subtitles: (data.subtitles ?? [])
      .filter((s) => s.url && s.lang)
      // "Thumbnails" arrives in the subtitle array as a sprite VTT, not a language.
      .filter((s) => !/thumbnail/i.test(s.lang as string))
      .map((s) => ({ url: s.url as string, lang: s.lang as string })),
    intro: span(data.intro),
    outro: span(data.outro),
    referer: data.headers?.Referer ?? data.headers?.referer,
  };
}

function span(value?: { start?: number; end?: number }) {
  if (!value) return undefined;
  const start = Number(value.start ?? 0);
  const end = Number(value.end ?? 0);
  // Providers return {start: 0, end: 0} to mean "we don't know", and skipping
  // to zero would put the viewer back at the beginning on a loop.
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return { start, end };
}

export { toLangCode };
