import {
  ProviderError,
  type ProviderEpisodeSources, type ProviderSource, type ProviderSubtitle,
} from './types';
/**
 * Just enough of a server to address this API: the public label for
 * diagnostics and the upstream this entry routes to. The canonical list lives
 * in ./servers, which stays free of server-only code so the player's menu can
 * import it in the browser.
 */
export interface AniheistServer {
  id: string;
  label: string;
  provider?: string;
  note?: string;
}

/**
 * AniHeist — https://github.com/ZenHamza/AniHeist-api
 *
 * A separate service, so this is an HTTP adapter rather than a scraper. Two
 * things make it worth putting ahead of everything else in the chain:
 *
 *   - It takes an AniList id directly. Every other source here has to search
 *     its catalogue by title and score the results, which is the step that
 *     fails silently and serves the wrong season. That whole class of bug
 *     does not exist on this path.
 *   - It runs its own fallback chain and proxy pool server-side, so one
 *     request covers several upstreams.
 *
 * It is a Python service. It cannot run inside this app the way the `aniwatch`
 * package does — it has to be deployed, and ANIHEIST_API_URL pointed at it.
 * The repository ships a Dockerfile and a compose file for that.
 */

const DEFAULT_BASE = 'https://api.aniheist.com';

function baseUrl(): string {
  return (process.env.ANIHEIST_API_URL || DEFAULT_BASE).replace(/\/+$/, '');
}

/** On by default: unlike the scraper services, there is a public instance. */
export function aniheistConfigured(): boolean {
  return process.env.ANIHEIST_ENABLED !== '0';
}

interface StreamResponse {
  status?: string;
  data?: {
    video_url?: string;
    format?: string;
    source?: string;
    subtitles?: { lang?: string; label?: string; url?: string }[];
    headers?: Record<string, string>;
  };
  error?: { code?: string; message?: string };
}

/**
 * One episode, from one server, in one audio.
 *
 * `dub` is a separate request rather than a separate field in the answer, so
 * the caller makes both and keeps whichever came back.
 */
export async function aniheistSources(
  anilistId: number,
  episode: number,
  options: {
    server?: AniheistServer; dub?: boolean; timeoutMs?: number; label?: string;
    /** 'auto' lets the API pick, which is how an embed is obtained. */
    backend?: 'miruro' | 'auto';
  } = {},
): Promise<ProviderEpisodeSources> {
  const params = new URLSearchParams({
    anime_id: String(anilistId),
    episode: String(episode),
  });

  /*
   * Which backend to ask for.
   *
   * 'miruro' returns direct HLS and MP4, which the app's own player can drive
   * fully. Left to itself the API prefers a backend that answers with an
   * embed, so the direct servers pin it. The embed servers deliberately do
   * not: an embed is the one path fetched by the viewer's browser instead of
   * this server, so it is worth having when a host refuses us.
   */
  if (options.backend !== 'auto') params.set('source', 'miruro');
  if (options.dub) params.set('dub', 'true');
  if (options.server?.provider) params.set('provider', options.server.provider);

  const label = options.label ?? options.server?.id ?? 'This server';
  const url = `${baseUrl()}/api/stream?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
      cache: 'no-store',
    });
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new ProviderError(
      `${label} did not answer.`,
      `${label}: ${detail}. Nothing at ${baseUrl()} answered — set ANIHEIST_API_URL to a ` +
        'deployment you control, or ANIHEIST_ENABLED=0 to skip it.',
    );
  }

  const body = (await res.json().catch(() => null)) as StreamResponse | null;

  if (!res.ok) {
    // The API names its own failures, and the code is the actionable half:
    // ANIME_NOT_FOUND is a catalogue gap, ALL_SOURCES_FAILED is upstream,
    // RATE_LIMIT_EXCEEDED is us. Collapsing them into "error" loses that.
    const code = body?.error?.code ?? `HTTP ${res.status}`;
    const message = body?.error?.message ?? res.statusText;
    throw new ProviderError(
      res.status === 429
        ? `${label} is rate-limiting this deployment.`
        : `${label} could not serve that episode.`,
      `${label}: ${code} — ${message}`,
    );
  }

  const data = body?.data;
  const videoUrl = data?.video_url;
  if (!videoUrl) {
    throw new ProviderError(
      `${label} returned no source.`,
      `${label}: 200 with no video_url.`,
    );
  }

  const format = (data?.format ?? '').toLowerCase();

  // An embed is a player page rather than a stream, so it is marked as one and
  // carried instead of refused. It cannot be given to hls.js — that is a
  // manifest error at best and a spinner that never resolves at worst — but
  // the browser can load it in an iframe, and that request comes from the
  // viewer's own connection rather than this server's. When a host is
  // refusing datacentre addresses, this is the path that still plays.
  if (format === 'embed') {
    return {
      sources: [{ url: videoUrl, quality: 'auto', isM3U8: false, isEmbed: true }],
      subtitles: [],
    };
  }

  const isM3U8 = format === 'hls' || /\.m3u8(\?|$)/i.test(videoUrl);

  const sources: ProviderSource[] = [{
    url: videoUrl,
    // The API reports no per-rendition quality; an HLS master lists its own.
    quality: 'auto',
    isM3U8,
  }];

  const subtitles: ProviderSubtitle[] = (data?.subtitles ?? [])
    .filter((s) => s.url)
    .map((s) => ({ url: s.url as string, lang: s.label || s.lang || 'Unknown' }));

  return {
    sources,
    subtitles,
    // Its CDNs check Referer, which a browser cannot set on segment requests —
    // the signed proxy attaches it.
    referer: data?.headers?.Referer ?? data?.headers?.referer,
  };
}

/** Whether the configured instance is up, for the setup screen's live check. */
export async function aniheistHealthy(timeoutMs = 6_000): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { baseUrl as aniheistBaseUrl };
