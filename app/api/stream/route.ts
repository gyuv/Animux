import { NextResponse } from 'next/server';

/**
 * Stream resolution.
 *
 * This route defines the contract the player consumes; it does not source
 * video itself. Point STREAM_PROVIDER_URL at whatever licensed backend you are
 * entitled to serve from and return the shape below. Without that variable
 * set, the route serves public test streams so the player, the language
 * switching, the subtitle pipeline, chapter skipping and resume logic are all
 * fully exercisable in development.
 *
 *   GET /api/stream?id=<anilistId>&ep=<n>
 *   {
 *     sources:   [{ id, label, url, type: 'hls' | 'mp4', audioLang, kind, quality? }]
 *     subtitles: [{ lang, label, url, default? }]
 *     chapters:  { intro?: [start, end], outro?: [start, end] }
 *     duration:  number | null
 *   }
 *
 * `audioLang` and `kind` are what drive the language picker in the player: a
 * title with a Japanese track plus English and Hindi dubs returns three
 * sources, and the viewer's stored preference selects among them.
 */

export const runtime = 'nodejs';

export interface StreamSource {
  id: string;
  label: string;
  url: string;
  type: 'hls' | 'mp4';
  audioLang: string;
  kind: 'sub' | 'dub';
  /** Optional hint for fixed-rendition sources; HLS reports its own levels. */
  quality?: string;
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
}

/**
 * Public test streams. Two of them, labelled as if they were an original track
 * and a dub, because a language picker with one entry cannot be tested and the
 * first thing that breaks in a player is switching source mid-playback.
 */
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
  };
}

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
    return NextResponse.json(demo(id, ep), {
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
        signal: AbortSignal.timeout(12_000),
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

    // Caption files are fetched by the browser as same-origin text tracks, so
    // they are routed through our proxy rather than linked directly — a remote
    // .vtt without permissive CORS headers otherwise fails silently, and the
    // viewer just sees subtitles that never appear.
    const subtitles = (payload.subtitles ?? []).map((s) => ({
      ...s,
      url: s.url.startsWith('/') ? s.url : `/api/stream/captions?src=${encodeURIComponent(s.url)}`,
    }));

    return NextResponse.json(
      { ...payload, subtitles },
      { headers: { 'Cache-Control': 'public, max-age=300' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the streaming service.' },
      { status: 502 },
    );
  }
}
