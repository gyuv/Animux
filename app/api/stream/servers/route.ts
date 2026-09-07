import { NextResponse } from 'next/server';
import { getAnime } from '@/services/anilist';
import { withTimeout } from '@/lib/providers/types';
import { SERVERS } from '@/lib/providers/servers';
import { megaplayConfigured, megaplaySources } from '@/lib/providers/megaplay';
import { reanimeConfigured, reanimeFindSlug, reanimeSources } from '@/lib/providers/reanime';
import { aniheistConfigured, aniheistSources } from '@/lib/providers/aniheist';

/**
 * Which servers actually work from *this* deployment.
 *
 * The point of this route is that it runs where the app runs. Whether a
 * scraper answers depends entirely on the address asking — these hosts block
 * datacentre ranges, rate-limit by IP, and go down independently — so no
 * amount of checking from anywhere else settles it. One request here reports
 * the real answer for every server at once.
 *
 *   GET /api/stream/servers[?id=<anilistId>&ep=<n>]
 *
 * Servers are probed in parallel: they are unrelated hosts, so the slow one
 * costs its own latency rather than everyone else's.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Frieren — carried by every catalogue, so a miss is about the server. */
const DEFAULT_ID = 154587;
const PROBE_MS = 12_000;

interface Result {
  server: string;
  ok: boolean;
  ms: number;
  sources: number;
  audio: string[];
  subtitles: number;
  configured: boolean;
  error: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anilistId = Number(searchParams.get('id') ?? DEFAULT_ID);
  const episode = Number(searchParams.get('ep') ?? 1);

  // Only the slug-based servers need this, and only once between them.
  let titles: (string | null | undefined)[] = [];
  let titleError: string | null = null;
  try {
    const { anime } = await withTimeout(getAnime(anilistId), 8_000, 'anilist');
    titles = [anime.title.romaji, anime.title.english, ...(anime.synonyms ?? []).slice(0, 3)];
  } catch (err) {
    titleError = err instanceof Error ? err.message : String(err);
  }

  const results = await Promise.all(SERVERS.map(async (server): Promise<Result> => {
    const started = Date.now();
    const configured =
      server.backend === 'megaplay' ? megaplayConfigured()
        : server.backend === 'aniheist' ? aniheistConfigured()
          : reanimeConfigured();

    if (!configured) {
      return {
        server: server.label,
        ok: false,
        ms: 0,
        sources: 0,
        audio: [],
        subtitles: 0,
        configured: false,
        error: server.needsDeploy
          ? 'Not deployed. This server needs its own service running — see the README.'
          : 'Turned off by an environment variable.',
      };
    }

    const audio: string[] = [];
    let sources = 0;
    let subtitles = 0;
    let failure: string | null = null;

    // Sub and dub are separate requests everywhere, so both are reported:
    // "sub only" is a normal and useful answer, not a partial failure.
    for (const kind of ['sub', 'dub'] as const) {
      try {
        const got = await withTimeout(
          (async () => {
            if (server.backend === 'megaplay') {
              return megaplaySources(anilistId, episode, kind, PROBE_MS, server.label);
            }
            if (server.backend === 'aniheist') {
              return aniheistSources(anilistId, episode, {
                server: { id: server.id, label: server.label, provider: server.provider },
                dub: kind === 'dub',
                timeoutMs: PROBE_MS,
                label: server.label,
              });
            }
            if (titles.length === 0) {
              throw new Error(`no titles to search by — AniList lookup failed (${titleError})`);
            }
            const slug = await reanimeFindSlug(anilistId, titles, PROBE_MS, server.label);
            return reanimeSources(slug, episode, server.upstream ?? 'HD-1', kind, PROBE_MS, server.label);
          })(),
          PROBE_MS,
          server.label,
        );

        if (got.sources.length > 0) {
          audio.push(kind);
          sources += got.sources.length;
          subtitles += got.subtitles.length;
        }
      } catch (err) {
        // Only the sub failure is worth reporting: a title with no dub is the
        // normal case, and surfacing it as an error reads as a broken server.
        if (kind === 'sub') failure = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      server: server.label,
      ok: sources > 0,
      ms: Date.now() - started,
      sources,
      audio,
      subtitles,
      configured: true,
      error: sources > 0 ? null : failure ?? 'No playable source.',
    };
  }));

  const working = results.filter((r) => r.ok);

  const verdict = working.length === 0
    ? 'No server could play that episode from this deployment. Every entry below says why — ' +
      'a "not deployed" line is a server you have not set up yet, not a broken one.'
    : `${working.length} of ${results.length} servers work from here: ` +
      `${working.map((r) => r.server).join(', ')}. ` +
      'Any of these can be chosen in the player under Playback → Server.';

  return NextResponse.json(
    {
      verdict,
      testedWith: { anilistId, episode, titleLookup: titleError ? `failed: ${titleError}` : 'ok' },
      servers: results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.ms - b.ms),
      checkedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
