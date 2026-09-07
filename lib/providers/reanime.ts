import { ProviderError, type ProviderEpisodeSources, type ProviderSubtitle } from './types';
import { similarity, CONFIDENCE, MAX_QUERIES } from './matching';

/**
 * ReAnime — https://github.com/walterwhite-69/ReAnime.to-API
 *
 * A self-hosted service that scrapes reanime.to and decrypts flixcloud.cc's
 * HLS streams. Unlike the others it exposes *named* upstreams of its own —
 * HD-1 and HD-2, each in sub and dub — which is what makes it worth four
 * entries in the server list rather than one.
 *
 * It has to be deployed (the repo ships a railway.json); REANIME_API_URL
 * points at it. Without that this source is simply absent.
 *
 * One hard constraint from its README: stream responses must never be cached.
 * The tokens are single-use and the API answers 410 Gone on reuse, so a cached
 * URL is not a stale stream, it is a dead one.
 */

function baseUrl(): string | null {
  const raw = process.env.REANIME_API_URL;
  return raw ? raw.replace(/\/+$/, '') : null;
}

export function reanimeConfigured(): boolean {
  return baseUrl() !== null;
}

export type ReanimeServer = 'HD-1' | 'HD-2';

interface Candidate {
  slug?: string;
  id?: string;
  title?: string;
  name?: string;
  english?: string;
  japanese?: string;
  anilist?: number;
  cover_image?: Record<string, string>;
}

async function get<T>(path: string, timeoutMs: number, label: string): Promise<T> {
  const base = baseUrl();
  if (!base) throw new ProviderError('That server is not configured.', 'REANIME_API_URL is unset.');

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (err) {
    throw new ProviderError(
      'That server did not answer.',
      `${label}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)} (${base})`,
    );
  }

  if (res.status === 404) throw new ProviderError('That server has no such episode.', `${label}: HTTP 404`);
  if (!res.ok) throw new ProviderError('That server returned an error.', `${label}: HTTP ${res.status}`);

  return res.json() as Promise<T>;
}

/** The AniList id reanime.to carries, directly or in its AniList cover URL. */
function anilistOf(entry: Candidate): number | null {
  if (typeof entry.anilist === 'number') return entry.anilist;
  for (const key of ['extra_large', 'large', 'medium']) {
    const match = /\/bx(\d+)-/.exec(entry.cover_image?.[key] ?? '');
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * Find reanime's slug for a title.
 *
 * The AniList id is checked first and wins outright when present — it is an
 * identity, not a guess, and it makes the usual wrong-season failure
 * impossible. Title scoring is only the fallback for entries that carry no id.
 */
export async function reanimeFindSlug(
  anilistId: number,
  titles: (string | null | undefined)[],
  timeoutMs: number,
  label = 'This server',
): Promise<string> {
  const queries = [...new Set(titles.filter(Boolean) as string[])].slice(0, MAX_QUERIES);
  if (queries.length === 0) throw new ProviderError('No title to search that server by.');

  let best: { slug: string; score: number; name: string } | null = null;

  for (const query of queries) {
    const body = await get<unknown>(`/search?q=${encodeURIComponent(query)}&limit=20`, timeoutMs, label);

    // The upstream wraps its list differently depending on the endpoint, so
    // the array is located rather than assumed.
    const list: Candidate[] = Array.isArray(body)
      ? (body as Candidate[])
      : ((body as { data?: Candidate[]; results?: Candidate[]; animes?: Candidate[] })?.data
        ?? (body as { results?: Candidate[] })?.results
        ?? (body as { animes?: Candidate[] })?.animes
        ?? []);

    for (const entry of list) {
      const slug = entry.slug ?? entry.id;
      if (!slug) continue;

      if (anilistOf(entry) === anilistId) return slug;

      for (const name of [entry.title, entry.name, entry.english, entry.japanese]) {
        if (!name) continue;
        for (const title of queries) {
          const score = similarity(title, name);
          if (!best || score > best.score) best = { slug, score, name };
        }
      }
    }
  }

  if (best && best.score >= CONFIDENCE) return best.slug;

  throw new ProviderError(
    'That server does not list this title.',
    best
      ? `${label}: best match "${best.name}" scored ${best.score.toFixed(2)}, under the ${CONFIDENCE} bar.`
      : `${label}: search returned nothing for ${queries.length} title(s).`,
  );
}

interface ServersResponse {
  sub?: { serverName?: string; dataLink?: string }[];
  dub?: { serverName?: string; dataLink?: string }[];
  intro_start?: number | null;
  intro_end?: number | null;
  outro_start?: number | null;
  outro_end?: number | null;
}

interface StreamResponse {
  url?: string;
  subtitles?: { url?: string; language?: string; format?: string; default?: boolean }[];
  intro_chapter?: { start?: number; end?: number } | null;
  outro_chapter?: { start?: number; end?: number } | null;
}

function span(start?: number | null, end?: number | null) {
  const a = Number(start ?? 0);
  const b = Number(end ?? 0);
  // Zeroes mean "unknown"; skipping to zero would loop the viewer to the start.
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return undefined;
  return { start: a, end: b };
}

/** One episode from one of reanime's named upstreams, in one audio. */
export async function reanimeSources(
  slug: string,
  episode: number,
  server: ReanimeServer,
  audio: 'sub' | 'dub',
  timeoutMs: number,
  label = 'This server',
): Promise<ProviderEpisodeSources> {
  const listing = await get<ServersResponse>(
    `/servers/${encodeURIComponent(slug)}/${episode}`,
    timeoutMs,
    label,
  );

  const available = (audio === 'dub' ? listing.dub : listing.sub) ?? [];
  const match = available.find((s) => (s.serverName ?? '').toUpperCase() === server);

  if (!match?.dataLink) {
    throw new ProviderError(
      `That server has no ${audio} for this episode.`,
      `${label}: ${audio} not among [${available.map((s) => s.serverName).join(', ') || 'none'}].`,
    );
  }

  const stream = await get<StreamResponse>(
    `/stream/from-link?link=${encodeURIComponent(match.dataLink)}`,
    timeoutMs,
    label,
  );

  if (!stream.url) {
    throw new ProviderError('That server returned no playable source.', `${label}: decrypt returned no url.`);
  }

  const subtitles: ProviderSubtitle[] = (stream.subtitles ?? [])
    .filter((s) => s.url && s.language)
    .map((s) => ({ url: s.url as string, lang: s.language as string }));

  return {
    sources: [{
      url: stream.url,
      quality: 'auto',
      isM3U8: /\.m3u8(\?|$)/i.test(stream.url),
    }],
    subtitles,
    // Chapter marks come from the stream when it has them, and from the
    // episode listing when it does not.
    intro: span(stream.intro_chapter?.start, stream.intro_chapter?.end)
      ?? span(listing.intro_start, listing.intro_end),
    outro: span(stream.outro_chapter?.start, stream.outro_chapter?.end)
      ?? span(listing.outro_start, listing.outro_end),
  };
}
