import { NextResponse } from 'next/server';

/**
 * Caption proxy.
 *
 * A `<track>` element is subject to CORS, and subtitle files served from a
 * provider's CDN routinely lack the headers to satisfy it. The failure mode is
 * the worst kind: no error, no console warning in some browsers, just
 * subtitles that never appear. Serving them from our own origin removes the
 * whole class of problem.
 *
 * The host allowlist is the point of the route, not an afterthought: an
 * unrestricted `?src=` is a server-side request forgery hole that will happily
 * fetch a cloud metadata endpoint for anyone who asks.
 */

export const runtime = 'nodejs';

const MAX_BYTES = 2_000_000;

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();

  const provider = process.env.STREAM_PROVIDER_URL;
  if (provider) {
    try { hosts.add(new URL(provider).hostname); } catch { /* ignore a malformed value */ }
  }

  for (const entry of (process.env.STREAM_SUBTITLE_HOSTS ?? '').split(',')) {
    const host = entry.trim().toLowerCase();
    if (host) hosts.add(host);
  }

  return hosts;
}

/** Demo captions, generated here so the subtitle path works with no backend. */
function demoTrack(lang: string, episode: string): string {
  const lines =
    lang === 'es'
      ? ['Subtítulos de demostración', 'Conecta STREAM_PROVIDER_URL para los reales', `Episodio ${episode}`]
      : ['Demo subtitle track', 'Wire STREAM_PROVIDER_URL for the real ones', `Episode ${episode}`];

  const cue = (i: number, text: string) => {
    const start = 4 + i * 8;
    const stamp = (s: number) =>
      `00:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.000`;
    return `${i + 1}\n${stamp(start)} --> ${stamp(start + 6)}\n${text}\n`;
  };

  return `WEBVTT\n\n${lines.map((text, i) => cue(i, text)).join('\n')}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');

  if (!src) {
    const lang = searchParams.get('lang') ?? 'en';
    const ep = searchParams.get('ep') ?? '1';
    return new NextResponse(demoTrack(lang, ep), {
      headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({ error: 'Not a valid URL.' }, { status: 400 });
  }

  if (target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only https sources are proxied.' }, { status: 400 });
  }

  if (!allowedHosts().has(target.hostname)) {
    return NextResponse.json(
      { error: 'That host is not on the caption allowlist. Add it to STREAM_SUBTITLE_HOSTS.' },
      { status: 403 },
    );
  }

  try {
    const upstream = await fetch(target, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Could not fetch that caption file.' }, { status: 502 });
    }

    const body = await upstream.text();
    if (body.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Caption file is too large.' }, { status: 413 });
    }

    // Some providers still ship SRT under a .vtt name; the header is what the
    // browser actually parses against, and WebVTT requires the magic line.
    const text = body.startsWith('WEBVTT') ? body : `WEBVTT\n\n${body.replace(/,(\d{3})/g, '.$1')}`;

    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the caption source.' }, { status: 502 });
  }
}
