import { NextResponse } from 'next/server';
import { cooldownRemaining } from '@/lib/catalogue/limiter';

/**
 * Diagnostics for the catalogue.
 *
 * When the site says AniList is refusing us, this endpoint answers the only
 * question that matters next: is AniList down for everyone, or has this
 * particular server been blocked? Those have completely different fixes — wait
 * it out, versus move off the IP — and the difference is only visible in the
 * response body, which the app itself does not show the viewer.
 *
 * Visit /api/catalogue/health on the deployment that is failing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const USER_AGENT =
  process.env.ANILIST_USER_AGENT ??
  'Animux/2.0 (+https://animux.app; contact: support@animux.app)';

export async function GET() {
  const started = Date.now();

  let status = 0;
  let body = '';
  let transportError: string | null = null;
  const rateLimit: Record<string, string> = {};

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({ query: '{ Media(id: 1, type: ANIME) { id } }' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    status = res.status;
    body = (await res.text()).slice(0, 600);

    for (const header of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after']) {
      const value = res.headers.get(header);
      if (value) rateLimit[header] = value;
    }
  } catch (err) {
    transportError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }

  const verdict = (() => {
    if (transportError) return 'Cannot reach AniList at all — DNS, TLS, or egress is blocked.';
    if (status === 200) return 'AniList is answering normally.';
    if (status === 429) return 'Rate limited. Slow down; this clears on its own.';
    if (status === 403 && /block/i.test(body)) {
      return 'This server IP is blocked by AniList. Waiting will not fix it — deploy behind a different IP and keep request volume down.';
    }
    if (status === 403) {
      return 'AniList has disabled its public API. This affects everyone, not just Animux. Wait for it to come back.';
    }
    if (status >= 500) return 'AniList is having server trouble.';
    return `Unexpected status ${status}.`;
  })();

  return NextResponse.json(
    {
      verdict,
      anilist: { status, transportError, rateLimit, body },
      animux: {
        userAgentSent: USER_AGENT,
        selfImposedCooldownSeconds: cooldownRemaining(),
      },
      elapsedMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
