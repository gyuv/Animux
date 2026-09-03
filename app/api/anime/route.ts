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
    // Try multiple possible URL structures for animesalt.cx
    const possibleUrls = [
      `https://animesalt.cx/episode/${animeId}-${episodeId}/`,
      `https://animesalt.cx/watch/${animeId}/${episodeId}`,
      `https://animesalt.cx/anime/${animeId}/${episodeId}`,
    ];

    let $;
    let html = '';

    // Find the first working URL
    for (const url of possibleUrls) {
      const response = await fetch(url);
      if (response.ok) {
        html = await response.text();
        $ = load(html);
        break;
      }
    }

    if (!$) {
      return NextResponse.json(
        { error: 'Episode page not found', triedUrls: possibleUrls },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Strategy 1: Look for standard <video> tag
    let videoSrc = $('video.wp-video-shortcode').attr('src');
    
    // Strategy 2: Look for <source> inside <video>
    if (!videoSrc) {
      videoSrc = $('source').first().attr('src');
    }

    // Strategy 3: Look for JSON data in script tags (common for streaming sites)
    if (!videoSrc) {
      const scriptContent = $('script').filter((i, el) => {
        const content = $(el).html() || '';
        return content.includes('m3u8') || content.includes('hls') || content.includes('sources');
      });

      if (scriptContent.length > 0) {
        const scriptHtml = scriptContent.html() || '';
        // Regex to find M3U8 URLs
        const m3u8Match = scriptHtml.match(/https?:\/\/[^"'\\s]+\.m3u8/);
        if (m3u8Match) {
          videoSrc = m3u8Match[0];
        }
      }
    }

    if (!videoSrc) {
      return NextResponse.json(
        { error: 'No video source found', htmlSnippet: html.substring(0, 500) },
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
