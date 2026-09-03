import { NextResponse } from 'next/server';
import { getAnime } from '@/services/anilist';
import { signProxyUrl, signCaptionUrl } from '@/lib/stream/signing';
import {
  ProviderError, toLangCode, withTimeout, Budget,
  type ProviderEpisodeSources,
} from '@/lib/providers/types';
import { read as cacheRead, write as cacheWrite } from '@/lib/catalogue/cache';
import {
  consumetConfigured, consumetEpisodes, consumetSources,
  CONSUMET_PROVIDERS, type ConsumetProvider,
} from '@/lib/providers/consumet';
import {
  aniwatchConfigured, aniwatchEpisodes, aniwatchFindId, aniwatchSources,
} from '@/lib/providers/aniwatch';
import {
  hianimeConfigured, hianimeEpisodes, hianimeFindId, hianimeSources,
} from '@/lib/providers/hianime';
import {
  libProviderOrder, libFindId, libEpisodes, libSources,
  type ConsumetLibProvider,
} from '@/lib/providers/consumet-lib';

/**
 * Stream resolution.
 *
 * Four ways to get a payload, tried in order:
 *
 *   1. STREAM_PROVIDER_URL — your own backend, returning the shape below
 *      verbatim. Nothing here touches it beyond routing captions.
 *   2. CONSUMET_API_URL / ANIWATCH_API_URL — separate scraper services, if
 *      you run them, mapped onto that same shape by `lib/providers/`.
 *   3. The `aniwatch` package, scraping HiAnime inside this process. On by
 *      default because it needs nothing deployed; HIANIME_ENABLED=0 opts out.
 *   4. Nothing available — a setup screen, or STREAM_DEMO=1 for a test clip.
 *
 *   GET /api/stream?id=<anilistId>&ep=<n>[&provider=gogoanime|zoro|aniwatch]
 *   {
 *     sources:   [{ id, label, url, type: 'hls' | 'mp4', audioLang, kind, quality? }]
 *     subtitles: [{ lang, label, url, default? }]
 *     chapters:  { intro?: [start, end], outro?: [start, end] }
 *     duration:  number | null
 *   }
 *
 * Note on legality: options 2 and 3 scrape sites that hold no licence to the
 * content they serve. Option 1 is the path without that problem.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Scraping is slow — a search, an info page and a source lookup, each a real
 * HTTP round trip to a site that is not fast. Three numbers keep that inside
 * a serverless invocation:
 *
 *   PROVIDER_MS  what one provider may take before the next one is tried
 *   BUDGET_MS    the whole chain's wall clock, under maxDuration in vercel.json
 *   CACHE_TTL    how long a resolved episode is reused
 *
 * Without the first two, one hung provider consumes the entire invocation and
 * the fallbacks behind it never run — the request dies and the player spins.
 */
const PROVIDER_MS = 9_000;
const BUDGET_MS = 26_000;
/** Short: these URLs are signed upstream and expire, so a long cache serves 403s. */
const CACHE_TTL = 240;

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
  source?: 'own' | 'consumet' | 'aniwatch' | 'hianime' | 'demo';
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

/**
 * The same shape as `fromAniwatch`, against the scraper running in this
 * process rather than a service you had to deploy first.
 */
async function fromHiAnime(
  titles: (string | null | undefined)[],
  episode: number,
): Promise<StreamPayload> {
  const animeId = await hianimeFindId(titles);
  if (!animeId) throw new ProviderError('Could not match this title on HiAnime.');

  const episodes = await hianimeEpisodes(animeId);
  const match = episodes.find((e) => e.number === episode);
  if (!match) throw new ProviderError(`Episode ${episode} is not listed by this source.`);

  // Sub and dub are separate lookups; a missing dub is normal, not an error.
  const [sub, dub] = await Promise.all([
    hianimeSources(match.id, 'sub').catch(() => null),
    hianimeSources(match.id, 'dub').catch(() => null),
  ]);

  if (!sub && !dub) throw new ProviderError('That episode returned no playable source.');

  const payloads: StreamPayload[] = [];
  if (sub) payloads.push(toPayload(sub, 'HiAnime (sub)', 'sub', 'ja'));
  if (dub) payloads.push(toPayload(dub, 'HiAnime (dub)', 'dub', 'en'));

  return merge(payloads);
}

/**
 * One of Consumet's in-process scrapers. Same shape as the others; the
 * provider name is the only thing that varies, so the fallback chain is a
 * list rather than a branch per source.
 */
async function fromLibProvider(
  name: ConsumetLibProvider,
  titles: (string | null | undefined)[],
  episode: number,
): Promise<StreamPayload> {
  const animeId = await libFindId(name, titles);
  if (!animeId) throw new ProviderError(`Could not match this title on ${name}.`);

  const episodes = await libEpisodes(name, animeId);
  const match = episodes.find((e) => e.number === episode);
  if (!match) throw new ProviderError(`Episode ${episode} is not listed by this source.`);

  const resolved = await libSources(name, match.id);
  return toPayload(resolved, name, 'sub', 'ja');
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

  const cacheKey = `stream:${anilistId}:${episode}:${requested ?? 'auto'}`;
  const cached = cacheRead<StreamPayload>(cacheKey);
  if (cached?.fresh) {
    return NextResponse.json(cached.value, {
      headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'cache' },
    });
  }

  const budget = new Budget(BUDGET_MS);

  /* 2. The scraper APIs. */
  if (consumetConfigured() || aniwatchConfigured() || hianimeConfigured()) {
    const failures: string[] = [];

    const order: ConsumetProvider[] = requested === 'zoro' || requested === 'gogoanime'
      ? [requested]
      : CONSUMET_PROVIDERS;

    if (consumetConfigured() && requested !== 'aniwatch') {
      for (const name of order) {
        if (budget.spent()) break;
        try {
          const payload = await withTimeout(
            fromConsumet(anilistId, episode, name),
            budget.slice(PROVIDER_MS),
            `consumet/${name}`,
          );
          cacheWrite(cacheKey, { ...payload, source: 'consumet' }, CACHE_TTL);
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
        const payload = await withTimeout(
          fromAniwatch(
            [anime.title.romaji, anime.title.english, ...(anime.synonyms ?? []).slice(0, 3)],
            episode,
          ),
          budget.slice(PROVIDER_MS),
          'aniwatch',
        );
        cacheWrite(cacheKey, { ...payload, source: 'aniwatch' }, CACHE_TTL);
        return NextResponse.json({ ...payload, source: 'aniwatch' }, {
          headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'aniwatch' },
        });
      } catch (err) {
        failures.push(`aniwatch: ${describe(err)}`);
      }
    }

    // In-process scraper last: it needs no deployment, so it is the safety net
    // under whatever services you did configure rather than a competitor to them.
    if (hianimeConfigured()) {
      try {
        const { anime } = await getAnime(anilistId);
        const payload = await fromHiAnime(
          [anime.title.romaji, anime.title.english, ...(anime.synonyms ?? []).slice(0, 3)],
          episode,
        );
        return NextResponse.json({ ...payload, source: 'hianime' }, {
          headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'hianime' },
        });
      } catch (err) {
        failures.push(`hianime: ${describe(err)}`);
      }
    }

    // Consumet's own scrapers, in-process, as the last tier. Each one is a
    // different catalogue rather than a different route to the same one, so a
    // title missing from HiAnime can still resolve here.
    if (hianimeConfigured()) {
      let titles: (string | null | undefined)[] = [];
      try {
        const { anime } = await getAnime(anilistId);
        titles = [anime.title.romaji, anime.title.english, ...(anime.synonyms ?? []).slice(0, 3)];
      } catch {
        /* Without titles there is nothing to search by; fall through to 404. */
      }

      if (titles.length > 0) {
        for (const name of libProviderOrder()) {
          if (budget.spent()) {
            failures.push(`${name}: skipped, request budget spent`);
            break;
          }
          try {
            const payload = await withTimeout(
              fromLibProvider(name, titles, episode),
              budget.slice(PROVIDER_MS),
              name,
            );
            cacheWrite(cacheKey, { ...payload, source: 'hianime' }, CACHE_TTL);
            return NextResponse.json({ ...payload, source: 'hianime' }, {
              headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': `consumet-lib:${name}` },
            });
          } catch (err) {
            failures.push(`${name}: ${describe(err)}`);
          }
        }
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

  /* 3. Nothing configured.
   *
   * This used to serve a public test clip. That was a bad call: every episode
   * of every title played the same stock cartoon, which is indistinguishable
   * from the app being broken and wastes the viewer's time before they find
   * out no source is connected. Saying so outright is more useful than
   * playing something. The clip is still available behind STREAM_DEMO=1 for
   * working on the player itself. */
  if (process.env.STREAM_DEMO === '1') {
    return NextResponse.json(demo(id, ep), {
      headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'demo' },
    });
  }

  return NextResponse.json(
    {
      error: 'No streaming source is connected.',
      needsSetup: true,
    },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'unconfigured' } },
  );
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
