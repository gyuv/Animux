import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const data = searchParams.get('data'); // The hash like '8757150decbd89b0f5442ca3db4d0e0e'

  if (!data) {
    return NextResponse.json(
      { error: 'Missing data parameter' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    // 1. Fetch the player page to get the script
    const playerUrl = `https://as-cdn26.top/player/index.php?data=${data}&do=getVideo`;
    const response = await fetch(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch player page' },
        { status: response.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const html = await response.text();
    
    // 2. Extract the FirePlayer configuration script
    // Look for the script that calls 'fireload' or 'fireplay'
    const scriptMatch = html.match(/<script type="text\/javascript">(.*?)<\/script>/gs);
    
    if (!scriptMatch || scriptMatch.length === 0) {
      return NextResponse.json(
        { error: 'No script found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 3. Decode the minified script to find the M3U8 URL
    // The script uses a custom obfuscator. We can look for the 'sources' array.
    // Based on the previous analysis, the URL is likely in the 'sources' array.
    
    // Alternative: The URL is often passed as a parameter to the player function.
    // Let's try to find the 'm3u8' URL directly in the script content.
    const m3u8Match = html.match(/https?:\/\/[^"'\\s]+\.m3u8/);
    
    if (m3u8Match) {
      return NextResponse.json(
        { url: m3u8Match[0] },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        }
      );
    }

    // If direct match fails, try to extract from the obfuscated script
    // The obfuscated script often contains the URL in a variable assignment.
    // We can try to find the 'fireload' call and extract the argument.
    
    // For now, let's try a common pattern for this specific player:
    // The URL is often in a variable named 'source' or 'sources'.
    const sourceMatch = html.match(/source[:\s]*['"]([^'"]+\.m3u8)['"]/);
    if (sourceMatch) {
      return NextResponse.json(
        { url: sourceMatch[1] },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
          },
        }
      );
    }

    return NextResponse.json(
      { error: 'No stream URL found', htmlSnippet: html.substring(0, 500) },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve stream';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
