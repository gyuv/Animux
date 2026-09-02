import { NextResponse } from 'next/server';

/**
 * Stream resolution.
 *
 * This route defines the contract the player consumes; it does not source
 * video itself. Point STREAM_PROVIDER_URL at whatever licensed backend you
 * are entitled to serve from and return the shape below. Without that
 * variable set, the route serves a public test clip so the player, the
 * language switching and the resume logic are all fully exercisable in
 * development.
 *
 *   GET /api/stream?id=<anilistId>&ep=<n>
 *   {
 *     sources:   [{ id, label, url, type: 'hls' | 'mp4', audioLang, kind: 'sub' | 'dub' }]
 *     subtitles: [{ lang, label, url, default? }]
 *     chapters:  { intro?: [start, end], outro?: [start, end] }
 *     duration:  number | null
 *   }
 *
 * `audioLang` and `kind` are what drive the language picker in the player:
 * a title with a Japanese track plus English and Hindi dubs returns three
 * sources, and the viewer's stored preference selects among them.
 */

export const runtime = 'edge';

export interface StreamSource {
  id: string;
  label: string;
  url: string;
  type: 'hls' | 'mp4';
  audioLang: string;
  kind: 'sub' | 'dub';
}

export interface StreamPayload {
  sources: StreamSource[];
  subtitles: { lang: string; label: string; url: string; default?: boolean }[];
  chapters: { intro?: [number, number]; outro?: [number, number] };
  duration: number | null;
}

const DEMO: StreamPayload = {
  sources: [
    {
      id: 'demo-ja',
      label: 'Japanese',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      type: 'hls',
      audioLang: 'ja',
      kind: 'sub',
    },
  ],
  subtitles: [],
  chapters: { intro: [12, 102] },
  duration: null,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ep = searchParams.get('ep');

  if (!id || !ep) {
    return NextResponse.json(
      { error: 'Include both an id and an ep parameter.' },
      { status: 400 },
    );
  }

  const provider = process.env.STREAM_PROVIDER_URL;
  if (!provider) {
    return NextResponse.json(DEMO, {
      headers: { 'Cache-Control': 'no-store', 'X-Animux-Source': 'demo' },
    });
  }

  try {
    const upstream = await fetch(
      `${provider}?id=${encodeURIComponent(id)}&ep=${encodeURIComponent(ep)}`,
      {
        headers: process.env.STREAM_PROVIDER_KEY
          ? { Authorization: `Bearer ${process.env.STREAM_PROVIDER_KEY}` }
          : undefined,
        next: { revalidate: 300 },
      },
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'That episode is not available right now.' },
        { status: 502 },
      );
    }

    const payload = (await upstream.json()) as StreamPayload;
    if (!payload.sources?.length) {
      return NextResponse.json(
        { error: 'No playable source was returned for that episode.' },
        { status: 404 },
      );
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the streaming service.' },
      { status: 502 },
    );
  }
}
