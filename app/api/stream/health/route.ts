import { NextResponse } from 'next/server';

/**
 * Diagnostics for the streaming layer.
 *
 * Answers the question a deployment actually raises — "why am I getting a test
 * clip instead of the episode" — which was previously invisible: an
 * unconfigured install and a working one produced the same player, and the
 * only difference was a response header nobody looks at.
 *
 * Visit /api/stream/health on the deployment that is misbehaving.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Probe {
  configured: boolean;
  url: string | null;
  reachable: boolean | null;
  status: number | null;
  error: string | null;
}

async function probe(raw: string | undefined, path: string): Promise<Probe> {
  if (!raw) {
    return { configured: false, url: null, reachable: null, status: null, error: null };
  }

  const base = raw.replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    return {
      configured: true,
      url: base,
      reachable: res.ok,
      status: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      configured: true,
      url: base,
      reachable: false,
      status: null,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

export async function GET() {
  // Frieren, id 154587 — a title every provider carries, so a miss here is
  // about the provider rather than about an obscure show.
  const aniheistOn = process.env.ANIHEIST_ENABLED !== '0';

  const [own, consumet, aniwatch, aniheist] = await Promise.all([
    probe(process.env.STREAM_PROVIDER_URL, '?id=154587&ep=1'),
    probe(process.env.CONSUMET_API_URL, '/meta/anilist/info/154587?provider=gogoanime'),
    probe(process.env.ANIWATCH_API_URL, '/api/v2/hianime/search?q=frieren'),
    // Unlike the others this has a default, so it is probed whenever it is on
    // rather than only when a URL was set.
    aniheistOn
      ? probe(process.env.ANIHEIST_API_URL || 'https://api.aniheist.com', '/api/health')
      : Promise.resolve({ configured: false, url: null, reachable: null, status: null, error: null }),
  ]);

  const hianimeOn = process.env.HIANIME_ENABLED !== '0';
  const active = own.configured
    ? 'own'
    : aniheist.reachable
      ? 'aniheist'
      : consumet.configured
        ? 'consumet'
        : aniwatch.configured
          ? 'aniwatch'
          : hianimeOn
            ? 'hianime'
            : 'demo';

  const verdict = (() => {
    if (active === 'aniheist') {
      return `AniHeist is answering at ${aniheist.url}, and is tried first — it maps the AniList ` +
        'id directly, so no title matching is involved. Pick a server in the player under ' +
        'Playback → Server.';
    }
    if (aniheistOn && aniheist.reachable === false) {
      return `AniHeist at ${aniheist.url} is not answering (${aniheist.error}). Deploy the ` +
        'service from github.com/ZenHamza/AniHeist-api and set ANIHEIST_API_URL to it, or set ' +
        'ANIHEIST_ENABLED=0 so it stops taking a slice of every request.';
    }
    if (active === 'hianime') {
      return 'No service is configured, so episodes resolve through the in-process HiAnime ' +
        'scraper. Nothing to deploy; set HIANIME_ENABLED=0 to turn it off.';
    }
    if (active === 'demo') {
      return 'No streaming source is connected, so no episode can play. Deploy a source API and set ' +
        'ANIWATCH_API_URL (or CONSUMET_API_URL), or STREAM_PROVIDER_URL for your own licensed backend, then redeploy.';
    }
    if (own.configured && !own.reachable) return 'STREAM_PROVIDER_URL is set but not answering.';
    if (consumet.configured && !consumet.reachable) {
      return 'CONSUMET_API_URL is set but not answering. Check the instance is deployed and awake — ' +
        'free hosting tiers sleep, and the first request after a sleep often times out.';
    }
    if (aniwatch.configured && !aniwatch.reachable) return 'ANIWATCH_API_URL is set but not answering.';
    return 'A streaming source is configured and answering.';
  })();

  const warnings: string[] = [];
  const secret = process.env.STREAM_PROXY_SECRET;
  if (!secret || secret.length < 16) {
    warnings.push(
      'STREAM_PROXY_SECRET is unset or under 16 characters. Proxied stream URLs are signed with ' +
        'an ephemeral per-process key, so they break on restart and across instances. Set it to 32+ random characters.',
    );
  }

  return NextResponse.json(
    {
      verdict,
      activeSource: active,
      warnings,
      providers: {
        own,
        aniheist,
        consumet,
        aniwatch,
        hianime: { configured: hianimeOn, url: 'in-process (aniwatch package)', reachable: null, status: null, error: null },
      },
      checkedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
