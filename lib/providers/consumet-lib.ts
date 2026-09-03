import { ANIME, type IAnimeInfo, type ISource } from '@consumet/extensions';
import {
  ProviderError,
  type ProviderEpisode, type ProviderEpisodeSources,
} from './types';
import { bestMatch, MAX_QUERIES } from './matching';

/**
 * Consumet's scrapers, run in-process.
 *
 * The npm package is the same code the hosted Consumet API wrapped, minus the
 * service you had to deploy. Every provider it ships exposes the same four
 * methods, so one adapter drives all of them and adding a source is a string
 * in a list rather than another file.
 *
 * Note what is *not* here: Gogoanime. It was removed from the package, so the
 * `new Gogoanime()` that circulates in tutorials throws before it can fail at
 * anything more interesting.
 *
 * Several of these are not English catalogues — AnimeSaturn and AnimeUnity are
 * Italian, AnimeSama is French — which is the honest version of "multi
 * language": different providers carry different dubs, so the fallback chain
 * doubles as the language spread.
 */

export const CONSUMET_LIB_PROVIDERS = {
  animepahe: () => new ANIME.AnimePahe(),
  animekai: () => new ANIME.AnimeKai(),
  hianime: () => new ANIME.Hianime(),
  animesaturn: () => new ANIME.AnimeSaturn(),
  animeunity: () => new ANIME.AnimeUnity(),
  animesama: () => new ANIME.AnimeSama(),
} as const;

export type ConsumetLibProvider = keyof typeof CONSUMET_LIB_PROVIDERS;

/** Tried in order. Override with ANIME_PROVIDERS, comma separated. */
const DEFAULT_ORDER: ConsumetLibProvider[] = ['animepahe', 'animekai'];

export function libProviderOrder(): ConsumetLibProvider[] {
  const raw = process.env.ANIME_PROVIDERS;
  if (!raw) return DEFAULT_ORDER;

  const chosen = raw
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ConsumetLibProvider => v in CONSUMET_LIB_PROVIDERS);

  return chosen.length > 0 ? chosen : DEFAULT_ORDER;
}

/** Instances are stateless scrapers; one each is enough and saves the setup. */
const cache = new Map<ConsumetLibProvider, ReturnType<typeof CONSUMET_LIB_PROVIDERS[ConsumetLibProvider]>>();

function client(name: ConsumetLibProvider) {
  let instance = cache.get(name);
  if (!instance) {
    instance = CONSUMET_LIB_PROVIDERS[name]();
    cache.set(name, instance);
  }
  return instance;
}

function detail(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/** Consumet's `title` is sometimes a string and sometimes a localised object. */
function names(title: unknown): (string | null | undefined)[] {
  if (typeof title === 'string') return [title];
  if (title && typeof title === 'object') {
    const t = title as Record<string, unknown>;
    return [t.romaji, t.english, t.native, t.userPreferred].map((v) =>
      typeof v === 'string' ? v : null,
    );
  }
  return [];
}

/** Resolve a provider's own id for a show, from the names AniList knows. */
export async function libFindId(
  name: ConsumetLibProvider,
  titles: (string | null | undefined)[],
): Promise<string | null> {
  const queries = [...new Set(titles.filter(Boolean) as string[])].slice(0, MAX_QUERIES);
  if (queries.length === 0) return null;

  for (const query of queries) {
    const page = await client(name).search(query).catch(() => null);
    if (!page?.results?.length) continue;

    const id = bestMatch(
      queries,
      page.results.map((r) => ({ id: String(r.id ?? ''), names: names(r.title) })),
    );

    if (id) return id;
  }

  return null;
}

export async function libEpisodes(
  name: ConsumetLibProvider,
  animeId: string,
): Promise<ProviderEpisode[]> {
  let info: IAnimeInfo;
  try {
    info = await client(name).fetchAnimeInfo(animeId);
  } catch (err) {
    throw new ProviderError('Could not read the episode list for that title.', detail(err));
  }

  const episodes = (info.episodes ?? [])
    .filter((e) => e.id)
    .map((e, i) => ({
      id: String(e.id),
      number: Number.isFinite(e.number) ? Number(e.number) : i + 1,
      title: e.title ?? null,
      image: (e as { image?: string }).image ?? null,
      description: (e as { description?: string }).description ?? null,
    }));

  if (episodes.length === 0) throw new ProviderError('This source lists no episodes for that title.');

  return episodes.sort((a, b) => a.number - b.number);
}

export async function libSources(
  name: ConsumetLibProvider,
  episodeId: string,
): Promise<ProviderEpisodeSources> {
  let data: ISource;
  try {
    data = await client(name).fetchEpisodeSources(episodeId);
  } catch (err) {
    throw new ProviderError('That episode returned no playable source.', detail(err));
  }

  const sources = (data.sources ?? [])
    .filter((s) => s.url)
    .map((s) => ({
      url: s.url,
      quality: s.quality ?? 'auto',
      isM3U8: s.isM3U8 ?? /\.m3u8(\?|$)/i.test(s.url),
    }));

  if (sources.length === 0) throw new ProviderError('That episode returned no playable source.');

  const headers = (data.headers ?? {}) as Record<string, string>;

  return {
    sources,
    subtitles: (data.subtitles ?? [])
      .filter((s) => s.url && s.lang)
      // A thumbnail sprite rides in the same array under a language label.
      .filter((s) => !/thumbnail/i.test(s.lang))
      .map((s) => ({ url: s.url, lang: s.lang })),
    intro: span(data.intro),
    outro: span(data.outro),
    referer: headers.Referer ?? headers.referer,
  };
}

function span(value?: { start?: number; end?: number }) {
  if (!value) return undefined;
  const start = Number(value.start ?? 0);
  const end = Number(value.end ?? 0);
  // Zeroes mean "unknown"; skipping to zero would loop back to the start.
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return { start, end };
}
