import { ProviderError, type ProviderEpisodeSources } from './types';

/**
 * megaplay.buzz, addressed directly.
 *
 * The URL scheme is the whole API: /stream/ani/{anilistId}/{episode}/{sub|dub}
 * returns a player page, and the stream URL is in its markup. There is no
 * JSON endpoint and no search — which is a feature here, because it is keyed
 * by AniList id, so like AniHeist it needs no title matching and cannot
 * resolve to the wrong season.
 *
 * Confirmed against a working client rather than guessed: AniHeist's own
 * `consumet_api/pulsar.py` drives this exact scheme, and its extractor is the
 * source of the patterns below.
 *
 * It needs nothing deployed, which makes it the cheapest server to offer.
 */

const BASE = (process.env.MEGAPLAY_URL || 'https://megaplay.buzz').replace(/\/+$/, '');

export function megaplayConfigured(): boolean {
  return process.env.MEGAPLAY_ENABLED !== '0';
}

/**
 * Every shape the stream URL is written in on these player pages. Ordered
 * loosest first; the first pattern alone catches most of them, and the rest
 * exist because the markup is generated and does change.
 */
const PATTERNS: RegExp[] = [
  /(https?:\/\/[^\s"'<>\\]+\.(?:m3u8|mpd|mp4)(?:\?[^\s"'<>\\]*)?)/g,
  /"file"\s*:\s*"([^"]+\.(?:m3u8|mp4|mpd)[^"]*)"/g,
  /"src"\s*:\s*"([^"]+\.(?:m3u8|mp4|mpd)[^"]*)"/g,
  /'file'\s*:\s*'([^']+\.(?:m3u8|mp4|mpd)[^']*)'/g,
  /data-video-src="([^"]+)"/g,
  /<source[^>]+src="([^"]+\.(?:m3u8|mp4))"/g,
];

function extract(html: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    for (const match of html.matchAll(pattern)) {
      // JSON-escaped markup writes "https:\/\/host\/path".
      const url = (match[1] ?? match[0]).replace(/\\\//g, '/').trim();
      if (!/^https?:\/\//.test(url) || seen.has(url)) continue;
      seen.add(url);
      found.push(url);
    }
  }

  // A playlist beats a progressive file: it carries every rendition, so the
  // player can adapt instead of being pinned to whatever bitrate came first.
  return found.sort((a, b) => Number(b.includes('.m3u8')) - Number(a.includes('.m3u8')));
}

export async function megaplaySources(
  anilistId: number,
  episode: number,
  audio: 'sub' | 'dub',
  timeoutMs = 12_000,
  /* The server's public name. Diagnostics quote this rather than the upstream,
   * so a failure reads as the server the viewer actually chose. */
  label = 'This server',
): Promise<ProviderEpisodeSources> {
  const url = `${BASE}/stream/ani/${anilistId}/${episode}/${audio}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        // Its CDN checks both, and serves nothing without them.
        Referer: `${BASE}/`,
        Origin: BASE,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (err) {
    throw new ProviderError(
      'That server did not answer.',
      `${label}: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)} (${BASE})`,
    );
  }

  if (res.status === 404) {
    throw new ProviderError(
      'That server has no such episode.',
      `${label}: HTTP 404 for anilist ${anilistId} episode ${episode} ${audio}`,
    );
  }
  if (!res.ok) {
    throw new ProviderError('That server returned an error.', `${label}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const urls = extract(html);

  if (urls.length === 0) {
    // Worth distinguishing: a page that loaded but hid nothing playable is a
    // markup change or a missing dub, not an outage, and they need different
    // fixes. The page size is the cheapest signal of which.
    throw new ProviderError(
      'That server has no playable copy of this episode.',
      `${label}: 200 but no stream URL in ${html.length} bytes ` +
        `(anilist ${anilistId} ep ${episode} ${audio}) — likely no ${audio} for this title, ` +
        'or the page markup changed.',
    );
  }

  return {
    sources: urls.slice(0, 3).map((u) => ({
      url: u,
      quality: 'auto',
      isM3U8: /\.m3u8(\?|$)/i.test(u),
    })),
    subtitles: [],
    // Segments are Referer-locked to the same host the page came from.
    referer: `${BASE}/`,
  };
}

/**
 * The same episode as a player page, handed straight to the browser.
 *
 * Nothing is fetched here, and that is deliberate rather than lazy. Checking
 * the page first would reintroduce exactly the failure this path exists to
 * route around: the check runs from the server, and a host that refuses the
 * server would fail the check while serving the viewer's own connection
 * perfectly. Offering it unverified is what makes it useful — it is a server
 * the viewer picks on purpose, and an iframe that loads an error page is a
 * visible, recoverable outcome rather than a silent one.
 */
export function megaplayEmbed(
  anilistId: number,
  episode: number,
  audio: 'sub' | 'dub',
): ProviderEpisodeSources {
  return {
    sources: [{
      url: `${BASE}/stream/ani/${anilistId}/${episode}/${audio}`,
      quality: 'auto',
      isM3U8: false,
      isEmbed: true,
    }],
    subtitles: [],
  };
}
