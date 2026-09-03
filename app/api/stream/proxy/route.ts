import { NextResponse } from 'next/server';
import { verifyProxyUrl, signProxyUrl } from '@/lib/stream/signing';

/**
 * Stream proxy.
 *
 * This is the piece without which none of these providers play in a browser.
 * The CDNs they resolve to reject any request that does not carry the right
 * `Referer`, and a page cannot set `Referer` on the requests hls.js makes for
 * segments — so the fetch has to happen server-side, with the header attached.
 * Cross-origin also means no CORS headers on the upstream, which the proxy
 * settles by virtue of being same-origin.
 *
 * A playlist is not just forwarded: every URI inside it (variant playlists,
 * segments, and the encryption key) is rewritten to come back through here,
 * because the moment a segment URL goes direct the browser fetches it without
 * the Referer and the stream stalls a few seconds in.
 *
 * Only URLs this server signed are fetched — see `lib/stream/signing.ts`.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLAYLIST_TYPES = /mpegurl|m3u8/i;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const verified = verifyProxyUrl(searchParams);

  if (!verified.ok) {
    const status = verified.reason === 'expired' ? 410 : 403;
    return NextResponse.json({ error: `Proxy rejected the request (${verified.reason}).` }, { status });
  }

  const { url, referer } = verified;

  const headers: Record<string, string> = {
    // Some CDNs check for a browser-shaped UA as well as the Referer.
    'User-Agent':
      process.env.STREAM_PROXY_USER_AGENT ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: '*/*',
  };
  // Hotlink protection almost always checks for *a* plausible Referer rather
  // than one exact value, so an asset with no Referer recorded for it gets its
  // own origin — which is what a browser on the provider's own page would send.
  const effectiveReferer = referer || originOf(url);
  if (effectiveReferer) {
    headers.Referer = effectiveReferer;
    try {
      headers.Origin = new URL(effectiveReferer).origin;
    } catch {
      /* A malformed Referer is not worth failing the request over. */
    }
  }

  // Range requests matter: without forwarding them, seeking in a progressive
  // mp4 re-downloads from zero and the player appears to hang on every scrub.
  const range = request.headers.get('range');
  if (range) headers.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the stream host.' }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `The stream host returned ${upstream.status}.` },
      { status: upstream.status === 403 ? 403 : 502 },
    );
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  const isPlaylist =
    verified.kind === 'playlist' || PLAYLIST_TYPES.test(contentType) || /\.m3u8(\?|$)/i.test(url);

  if (isPlaylist) {
    const body = await upstream.text();
    return new NextResponse(rewritePlaylist(body, url, referer), {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Segments are streamed rather than buffered — a 10 MB fragment held in
  // memory per viewer is how this route falls over under any real load.
  const passthrough = new Headers();
  for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = upstream.headers.get(header);
    if (value) passthrough.set(header, value);
  }
  passthrough.set('Cache-Control', 'public, max-age=3600');

  return new NextResponse(upstream.body, { status: upstream.status, headers: passthrough });
}

/**
 * Rewrite every URI in an HLS playlist to come back through the proxy,
 * resolved against the playlist's own address so relative paths survive.
 */
function originOf(url: string): string | null {
  try {
    return `${new URL(url).origin}/`;
  } catch {
    return null;
  }
}

function rewritePlaylist(body: string, playlistUrl: string, referer: string | null): string {
  const base = new URL(playlistUrl);
  const proxied = (raw: string, kind: 'playlist' | 'segment') => {
    const absolute = new URL(raw, base).toString();
    return signProxyUrl({ url: absolute, referer: referer ?? undefined }, kind);
  };

  return body
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Encryption keys and media renditions carry their URI as an attribute.
      if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-SESSION-KEY')) {
        return trimmed.replace(/URI="([^"]+)"/, (_, uri) => `URI="${proxied(uri, 'segment')}"`);
      }
      if (trimmed.startsWith('#EXT-X-MEDIA')) {
        return trimmed.replace(/URI="([^"]+)"/, (_, uri) => `URI="${proxied(uri, 'playlist')}"`);
      }
      if (trimmed.startsWith('#EXT-X-MAP')) {
        return trimmed.replace(/URI="([^"]+)"/, (_, uri) => `URI="${proxied(uri, 'segment')}"`);
      }
      if (trimmed.startsWith('#')) return line;

      // A bare line is either a variant playlist or a media segment. Getting
      // this wrong only costs a mislabelled `k`, which the content-type sniff
      // in the handler corrects anyway.
      return proxied(trimmed, /\.m3u8(\?|$)/i.test(trimmed) ? 'playlist' : 'segment');
    })
    .join('\n');
}
