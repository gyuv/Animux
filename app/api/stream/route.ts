import { NextResponse } from 'next/server';
import { getAnime } from '@/services/anilist';
import { signProxyUrl, signCaptionUrl } from '@/lib/stream/signing';
import { ProviderError, toLangCode, type ProviderEpisodeSources } from '@/lib/providers/types';
import {
  consumetConfigured, consumetEpisodes, consumetSources,
  CONSUMET_PROVIDERS, type ConsumetProvider,
} from '@/lib/providers/consumet';
import {
  aniwatchConfigured, aniwatchEpisodes, aniwatchFindId, aniwatchSources,
} from '@/lib/providers/aniwatch';

/**
 * Stream resolution.
 *
 * Three ways to get a payload, tried in order:
 *
 *   1. STREAM_PROVIDER_URL — your own backend, returning the shape below
 *      verbatim. Nothing here touches it beyond routing captions.
 *   2. CONSUMET_API_URL / ANIWATCH_API_URL — the scraper APIs, mapped onto
 *      that same shape by the adapters in `lib/providers/`.
 *   3. Neither set — public test streams, so the player is exercisable.
 *
 *   GET /api/stream?id=<anilistId>&ep=<n>[&provider=gogoanime|zoro|aniwatch]
 *   {
 *     sources:   [{ id, label, url, type: 'hls' | 'mp4', audioLang, kind, quality? }]
 *     subtitles: [{ lang, label, url, default? }]
 *     chapters:  { intro?: [start, end], outro?: [start, end] }
 *     duration:  number | null
 *   }
 *
 * Note on legality: Consumet and Aniwatch scrape streams from sites that hold
 * no licence to them. Neither is hosted for you and neither is enabled unless
 * you set its variable. Option 1 is the path that does not have that problem.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StreamSource {
  id: string;
  label: string;
  url: string;
  type: 'hls' | 'mp4';
  audioLang: string;
  kind: 'sub' | 'dub';
  /** Optional hint for fixed-rendition sources; HLS reports its own levels. */
  quality?: string;
  /**
   * Route this URL through the signed proxy instead of handing it to the
   * player directly. Needed whenever the host checks `Referer` or serves no
   * CORS headers — which is most of them — because the proxy is also what
   * rewrites the URIs inside an HLS manifest. Implied by `referer`.
   */
  proxy?: boolean;
  /** Referer the host requires. Setting it implies `proxy: true`. */
  referer?: string;
}

export interface StreamSubtitle {
  lang: string;
  label: string;
  url: string;
  default?: boolean;
}

export interface StreamPayload {
  sources: StreamSource[];
  subtitles: StreamSubtitle[];
  chapters: { intro?: [number, number]; outro?: [number, number] };
  duration: number | null;
  /**
   * Which of the three paths answered. The player renders a standing notice
   * for 'demo', because an unconfigured deployment silently playing a stock
   * cartoon is indistinguishable from a broken one — it looks like the app is
   * lying to you rather than like a setting is missing.
   */
  source?: 'own' | 'consumet' | 'aniwatch' | 'demo';
  /** Referer applied to this payload's caption files, when they need one. */
  referer?: string;
}

/* ------------------------------------------------------------------ demo */

function demo(id: string, ep: string): StreamPayload {
  return {
    sources: [
      {
        id: 'demo-ja',
        label: 'Japanese (original)',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'hls',
        audioLang: 'ja',
        kind: 'sub',
      },
      {
        id: 'demo-en',
        label: 'English (dub)',
        url: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
        type: 'hls',
        audioLang: 'en',
        kind: 'dub',
      },
    ],
    subtitles: [
      {
        lang: 'en',
        label: 'English',
        url: `/api/stream/captions?lang=en&id=${encodeURIComponent(id)}&ep=${encodeURIComponent(ep)}`,
        default: true,
      },
      {
        lang: 'es',
        label: 'Español',
        url: `/api/stream/captions?lang=es&id=${encodeURIComponent(id)}&ep=${encodeURIComponent(ep)}`,
      },
    ],
    chapters: { intro: [12, 102] },
    duration: null,
    source: 'demo',
  };
}

/* -------------------------------------------------------------- mapping */

/**
 * Turn a provider's answer into the player's payload, routing every URL
 * through the signed proxy so the Referer the CDN demands is actually sent.
 */
function toPayload(
  resolved: ProviderEpisodeSources,
  label: string,
  kind: 'sub' | 'dub',
  audioLang: string,
): StreamPayload {
  const referer = resolved.referer;

  const sources: StreamSource[] = resolved.sources.map((s, i) => ({
    id: `${label}-${s.quality}-${i}`,
    label: resolved.sources.length > 1 ? `${label} · ${s.quality}` : label,
    url: signProxyUrl({ url: s.url, referer }, s.isM3U8 ? 'playlist' : 'segment'),
    type: s.isM3U8 ? 'hls' : 'mp4',
    audioLang,
    kind,
    quality: s.quality,
  }));

  const subtitles: StreamSubtitle[] = resolved.subtitles.map((s, i) => ({
    lang: toLangCode(s.lang),
    label: s.lang,
    // Captions go through their own proxy, which normalises SRT and settles
    // CORS. Signed, because these hosts are only known once the provider answers.
    url: signCaptionUrl(s.url, referer),
    default: i === 0,
  }));

  const chapters: StreamPayload['chapters'] = {};
  if (resolved.intro) chapters.intro = [resolved.intro.start, resolved.intro.end];
  if (resolved.outro) chapters.outro = [resolved.outro.start, resolved.outro.end];

  return { sources, subtitles, chapters, duration: null };
}

/** Merge payloads from several providers into one language picker. */
function merge(payloads: StreamPayload[]): StreamPayload {
  const seen = new Set<string>();
  const sources: StreamSource[] = [];
  const subtitles: StreamSubtitle[] = [];
  let chapters: StreamPayload['chapters'] = {};

  for (const payload of payloads) {
    sources.push(...payload.sources);
    for (const sub of payload.subtitles) {
      if (seen.has(sub.lang)) continue;
      seen.add(sub.lang);
      subtitles.push({ ...sub, default: subtitles.length === 0 });
    }
    if (!chapters.intro && !chapters.outro) chapters = payload.chapters;
  }

  return { sources, subtitles, chapters, duration: null };
}

/* ------------------------------------------------------------- resolvers */

async function fromConsumet(
  anilistId: number,
  episode: number,
  provider: ConsumetProvider,
): Promise<StreamPayload> {
  const episodes = await consumetEpisodes(anilistId, provider);
  const match = episodes.find((e) => e.number === episode);
  if (!match) throw new ProviderError(`Episode ${episode} is not listed by this source.`);

  const resolved = await consumetSources(match.id, provider);
  // These providers serve subtitled originals; a dub arrives as its own entry.
  return toPayload(resolved, provider === 'zoro' ? 'HiAnime' : 'Gogoanime', 'sub', 'ja');
}

async function fromAniwatch(
  titles: (string | null | undefined)[],
  episode: number,
): Promise<StreamPayload> {
  const animeId = await aniwatchFindId(titles);
  if (!animeId) throw new ProviderError('Could not match this title on the fallback source.');

  const episodes = await aniwatchEpisodes(animeId);
  const match = episodes.find((e) => e.number === episode);
  if (!match) throw new ProviderError(`Episode ${episode} is not listed by this source.`);

  // Sub and dub are separate requests; a missing dub is normal, not an error.
  const [sub, dub] = await Promise.all([
    aniwatchSources(match.id, 'sub').catch(() => null),
    aniwatchSources(match.id, 'dub').catch(() => null),
  ]);

  if (!sub && !dub) throw new ProviderError('That episode returned no playable source.');

  const payloads: StreamPayload[] = [];
  if (sub) payloads.push(toPayload(sub, 'HiAnime (sub)', 'sub', 'ja'));
  if (dub) payloads.push(toPayload(dub, 'HiAnime (dub)', 'dub', 'en'));

  return merge(payloads);
}

/* ------------------------------------------------------------------ route */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ep = searchParams.get('ep');
  const requested = searchParams.get('provider');

  if (!id || !ep) {
    return NextResponse.json({ error: 'Include both an id and an ep parameter.' }, { status: 400 });
  }

  const anilistId = Number(id);
  const episode = Number(ep);
  if (!Number.isFinite(anilistId) || !Number.isFinite(episode) || episode < 1) {
    return NextResponse.json({ error: 'id and ep must both be numbers.' }, { status: 400 });
  }

  /* 1. Your own licensed backend, if you have one. */
  const provider = process.env.STREAM_PROVIDER_URL;
  if (provider) {
    return fromOwnBackend(provider, id, ep);
  }

  /* 2. The scraper APIs. */
  if (consumetConfigured() || aniwatchConfigured()) {
    const failures: string[] = [];

    const order: ConsumetProvider[] = requested === 'zoro' || requested === 'gogoanime'
      ? [requested]
      : CONSUMET_PROVIDERS;

    if (consumetConfigured() && requested !== 'aniwatch') {
      for (const name of order) {
        try {
          const payload = await fromConsumet(anilistId, episode, name);
          return NextResponse.json({ ...payload, source: 'consumet' }, {
            headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': `consumet:${name}` },
          });
        } catch (err) {
          failures.push(`consumet/${name}: ${describe(err)}`);
        }
      }
    }

    if (aniwatchConfigured()) {
      try {
        // Aniwatch has no AniList mapping, so it needs the title to search by.
        const { anime } = await getAnime(anilistId);
        const payload = await fromAniwatch(
          [anime.title.romaji, anime.title.english, ...(anime.synonyms ?? []).slice(0, 3)],
          episode,
        );
        return NextResponse.json({ ...payload, source: 'aniwatch' }, {
          headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'aniwatch' },
        });
      } catch (err) {
        failures.push(`aniwatch: ${describe(err)}`);
      }
    }

    return NextResponse.json(
      {
        error: 'No source could play that episode right now.',
        detail: failures.join(' | '),
      },
      { status: 404 },
    );
  }

  /* 3. Nothing configured — demo streams. */
  return NextResponse.json(demo(id, ep), {
    headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'demo' },
  });
}

function describe(err: unknown): string {
  if (err instanceof ProviderError) return err.message;
  return err instanceof Error ? err.message : String(err);
}

async function fromOwnBackend(provider: string, id: string, ep: string) {
  try {
    const upstream = await fetch(
      `${provider}?id=${encodeURIComponent(id)}&ep=${encodeURIComponent(ep)}`,
      {
        headers: process.env.STREAM_PROVIDER_KEY
          ? { Authorization: `Bearer ${process.env.STREAM_PROVIDER_KEY}` }
          : undefined,
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(12_000),
      },
    );

    if (!upstream.ok) {
      return NextResponse.json({ error: 'That episode is not available right now.' }, { status: 502 });
    }

    const payload = (await upstream.json()) as StreamPayload;
    if (!payload.sources?.length) {
      return NextResponse.json(
        { error: 'No playable source was returned for that episode.' },
        { status: 404 },
      );
    }

    /* A backend that hands back a direct playlist URL usually needs the same
       treatment the scraper path gets: the CDN wants a Referer the browser
       cannot send, and the segment URIs inside the manifest have to be
       rewritten or playback stalls after the first fragment. Set `proxy: true`
       on a source (or give it a `referer`, which implies it) and it is routed
       through the signed proxy. Sources without either are passed straight to
       the player, which is right for anything you serve yourself. */
    const sources = payload.sources.map((s) => {
      const needsProxy = s.proxy === true || Boolean(s.referer);
      if (!needsProxy || s.url.startsWith('/')) return s;
      return {
        ...s,
        url: signProxyUrl(
          { url: s.url, referer: s.referer },
          s.type === 'hls' ? 'playlist' : 'segment',
        ),
      };
    });

    const subtitles = (payload.subtitles ?? []).map((s) => ({
      ...s,
      url: s.url.startsWith('/') ? s.url : signCaptionUrl(s.url, payload.referer),
    }));

    return NextResponse.json({ ...payload, sources, subtitles, source: 'own' }, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the streaming service.' }, { status: 502 });
  }
}
