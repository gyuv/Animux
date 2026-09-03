import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const animeId = searchParams.get('animeId');
  const episodeId = searchParams.get('episodeId');

  if (!animeId || !episodeId) {
    return NextResponse.json(
      { error: 'Missing animeId or episodeId' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const episodeUrl = `https://animesalt.cx/episode/${animeId}/${episodeId}/`;
    const response = await fetch(episodeUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch episode page' },
        { status: response.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const html = await response.text();
    const $ = load(html);

    const videoSrc = $('video.wp-video-shortcode').attr('src') || $('source').first().attr('src');

    if (!videoSrc) {
      return NextResponse.json(
        { error: 'No video source found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { url: videoSrc },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve stream';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
