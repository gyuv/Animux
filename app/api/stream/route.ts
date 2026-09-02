// app/api/stream/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get('id');
  const episode = searchParams.get('episode');

  if (!animeId || !episode) {
    return NextResponse.json(
      { error: 'Missing anime ID or episode number' },
      { status: 400 }
    );
  }

  try {
    // Example: Fetching from your anime streaming provider API or scraper backend
    // (Replace this URL with your actual streaming provider or aggregation service endpoint)
    const providerUrl = `https://api.youranimeprovider.com/v1/watch/${animeId}?ep=${episode}`;

    const response = await fetch(providerUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.STREAM_PROVIDER_API_KEY || ''}`,
        'User-Agent': 'AnimeSalt-Webapp/1.0',
      },
      // Cache stream resolution briefly or disable caching for live sources
      cache: 'no-store', 
    });

    if (!response.ok) {
      throw new Error('Failed to resolve streaming sources from provider');
    }

    const data = await response.json();

    // Standardize the response structure for your frontend VideoPlayer
    const streamPayload = {
      videoUrl: data.sources?.[0]?.url || '',
      backupUrl: data.sources?.[1]?.url || '',
      subtitles: data.subtitles || [],
      audioTracks: data.audioTracks || [{ lang: 'jp', label: 'Japanese (Sub)' }],
      introMarker: data.intro || { start: 0, end: 90 }, // For auto-skip intro
      outroMarker: data.outro || { start: 1350, end: 1440 },
    };

    return NextResponse.json(streamPayload, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Stream Resolution Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error resolving stream links' },
      { status: 500 }
    );
  }
}
