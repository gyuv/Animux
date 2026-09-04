import { HiAnime } from 'aniwatch';
import {
  ProviderError,
  type ProviderEpisode, type ProviderEpisodeSources,
} from './types';
import { matchWithReport, describeMatchFailure, MAX_QUERIES } from './matching';

/**
 * HiAnime, scraped in-process.
 *
 * The other two adapters call a separate service over HTTP, which means the
 * app cannot resolve an episode until you have deployed one — and the two
 * projects that served that role have both been taken off GitHub. This one
 * uses the `aniwatch` package directly, so the scraping happens inside the
 * app's own API routes and there is nothing else to stand up.
 *
 * It still runs on the server, not in the browser. That is not a preference:
 * the catalogue serves no CORS headers, so a page cannot read it, and the
 * segments it hands back are Referer-locked, which a browser cannot satisfy
 * on its own media requests. Anything claiming this works client-side is
 * describing something that loads a manifest and then stalls.
 */

let client: HiAnime.Scraper | null = null;

function scraper(): HiAnime.Scraper {
  if (!client) client = new HiAnime.Scraper();
  return client;
}

/** On by default — this path needs no configuration to work. */
export function hianimeConfigured(): boolean {
  return process.env.HIANIME_ENABLED !== '0';
}

/**
 * Which mirror the package is pointed at. It reads this once at import, so it
 * cannot be changed at runtime — but naming it in a failure message is the
 * difference between "something went wrong" and a fix the reader can apply.
 */
const DOMAIN = process.env.ANIWATCH_DOMAIN || 'aniwatchtv.to';

function wrap(err: unknown, fallback: string): ProviderError {
  const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return new ProviderError(fallback, detail);
}

/** Resolve a HiAnime id from the names AniList knows a show by. */
export async function hianimeFindId(titles: (string | null | undefined)[]): Promise<string> {
  const queries = [...new Set(titles.filter(Boolean) as string[])].slice(0, MAX_QUERIES);
  if (queries.length === 0) throw new ProviderError('HiAnime: no title to search by.');

  let lastFailure = 'HiAnime: no search was attempted.';

  for (const query of queries) {
    let result: Awaited<ReturnType<HiAnime.Scraper['search']>> | null = null;
    try {
      result = await scraper().search(query);
    } catch (err) {
      /*
       * A throw here is the host, not the title.
       *
       * The package wraps an Axios failure carrying no response as the bare
       * message "Something went wrong" — which is what a connect timeout looks
       * like, since its client sets `timeout: 8000` and a timeout has no
       * response to read a status from. So this is the host being unreachable
       * from wherever this is deployed, and retrying it with a different
       * spelling of the title cannot help: it spends another eight seconds,
       * and three titles is twenty-four — most of a serverless invocation,
       * leaving nothing for the providers queued behind this one. Stop at the
       * first throw and let them have the time.
       */
      throw new ProviderError(
        `HiAnime (${DOMAIN}) did not answer.`,
        `HiAnime: search for "${query}" threw — ${detailOf(err)}. Unreachable from this ` +
          `deployment; a bare "Something went wrong" is its 8s connect timeout, not a ` +
          `rejection. Point ANIWATCH_DOMAIN at a reachable mirror, or set ` +
          `HIANIME_ENABLED=0 to skip it.`,
      );
    }

    const report = matchWithReport(
      queries,
      (result.animes ?? []).map((a) => ({ id: a.id ?? '', names: [a.name, a.jname] })),
    );

    if (report.id) return report.id;
    lastFailure = describeMatchFailure(report, 'HiAnime');
  }

  throw new ProviderError(lastFailure, lastFailure);
}

function detailOf(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export async function hianimeEpisodes(animeId: string): Promise<ProviderEpisode[]> {
  let data: Awaited<ReturnType<HiAnime.Scraper['getEpisodes']>>;
  try {
    data = await scraper().getEpisodes(animeId);
  } catch (err) {
    throw wrap(err, 'Could not read the episode list for that title.');
  }

  const episodes = (data.episodes ?? [])
    .filter((e) => e.episodeId)
    .map((e, i) => ({
      id: e.episodeId as string,
      number: Number.isFinite(e.number) ? Number(e.number) : i + 1,
      title: e.title ?? null,
      // HiAnime lists no per-episode artwork; the title page keeps whatever
      // AniList had, and falls back to the numbered panel.
      image: null,
      description: null,
      isFiller: Boolean(e.isFiller),
    }));

  if (episodes.length === 0) throw new ProviderError('This source lists no episodes for that title.');

  return episodes.sort((a, b) => a.number - b.number);
}

export async function hianimeSources(
  episodeId: string,
  category: 'sub' | 'dub',
): Promise<ProviderEpisodeSources> {
  let data: Awaited<ReturnType<HiAnime.Scraper['getEpisodeSources']>>;
  try {
    data = await scraper().getEpisodeSources(episodeId, undefined, category);
  } catch (err) {
    throw wrap(err, 'That episode returned no playable source.');
  }

  const sources = (data.sources ?? [])
    .filter((s) => s.url)
    .map((s) => ({
      url: s.url,
      quality: s.quality ?? 'auto',
      isM3U8: s.isM3U8 ?? /\.m3u8(\?|$)/i.test(s.url),
    }));

  if (sources.length === 0) throw new ProviderError('That episode returned no playable source.');

  // `outro` is not in the published types but is present on the wire, so it is
  // read defensively rather than declared.
  const outro = (data as { outro?: { start?: number; end?: number } }).outro;

  return {
    sources,
    subtitles: (data.subtitles ?? [])
      .filter((s) => s.url && s.lang)
      // A thumbnail sprite arrives in the same array labelled "thumbnails".
      .filter((s) => !/thumbnail/i.test(s.lang))
      .map((s) => ({ url: s.url, lang: s.lang })),
    intro: span(data.intro),
    outro: span(outro),
    referer: data.headers?.Referer ?? data.headers?.referer,
  };
}

function span(value?: { start?: number; end?: number }) {
  if (!value) return undefined;
  const start = Number(value.start ?? 0);
  const end = Number(value.end ?? 0);
  // Zeroes mean "unknown"; skipping to zero would loop the viewer to the start.
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
  return { start, end };
}
