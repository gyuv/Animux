import { NextResponse } from 'next/server';
import { signProxyUrl } from '@/lib/stream/signing';
import { ProviderError } from '@/lib/providers/types';
import {
  consumetConfigured, consumetEpisodes, CONSUMET_PROVIDERS,
} from '@/lib/providers/consumet';

/**
 * Per-episode metadata from the streaming provider.
 *
 * AniList's `streamingEpisodes` is the only episode artwork the app had, and
 * its coverage is patchy — empty outright for most older and smaller titles,
 * and not keyed by episode number even when present. Consumet's meta routes
 * return `image`, `title` and `description` per episode against the AniList id
 * directly, which is both better data and correctly keyed.
 *
 *   GET /api/stream/episodes?id=<anilistId>
 *   { episodes: [{ number, title, image, imageProxy, description }] }
 *
 * Two image URLs are returned per episode. `image` is the provider's own, which
 * the browser can cache and which costs this server nothing; `imageProxy` is
 * the same file through the signed proxy, which costs a round trip but carries
 * the Referer some CDNs demand. The client tries the cheap one and falls back,
 * so the common case stays free and the locked-down case still renders.
 *
 * Returns an empty list rather than an error when nothing is configured, so
 * the title page treats it as "no extra data" and keeps its AniList fallback.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface EpisodeMeta {
  number: number;
  title: string | null;
  image: string | null;
  /** Same image through the signed proxy, for CDNs that check Referer. */
  imageProxy: string | null;
  description: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anilistId = Number(searchParams.get('id'));

  if (!Number.isFinite(anilistId)) {
    return NextResponse.json({ error: 'id must be a number.', episodes: [] }, { status: 400 });
  }

  if (!consumetConfigured()) {
    return NextResponse.json({ episodes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  for (const provider of CONSUMET_PROVIDERS) {
    try {
      const episodes = await consumetEpisodes(anilistId, provider);
      const withArt = episodes.filter((e) => e.image).length;

      // gogoanime lists episodes but rarely carries artwork; if this provider
      // returned none, the next one is worth a try before giving up.
      if (withArt === 0 && provider !== CONSUMET_PROVIDERS[CONSUMET_PROVIDERS.length - 1]) {
        continue;
      }

      const payload: EpisodeMeta[] = episodes.map((e) => ({
        number: e.number,
        title: e.title,
        image: e.image,
        imageProxy: e.image ? signProxyUrl({ url: e.image }, 'segment') : null,
        description: e.description,
      }));

      return NextResponse.json(
        { episodes: payload },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            'X-Animux-Source': `consumet:${provider}`,
          },
        },
      );
    } catch (err) {
      if (!(err instanceof ProviderError)) throw err;
      // Try the next provider; an exhausted list falls through to empty.
    }
  }

  return NextResponse.json({ episodes: [] }, { headers: { 'Cache-Control': 'no-store' } });
}
