import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get('id');
  const episode = searchParams.get('episode');

  if (!animeId || !episode) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    return NextResponse.json({
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      subtitles: [],
      audioTracks: [{ lang: 'jp', label: 'Japanese' }]
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
