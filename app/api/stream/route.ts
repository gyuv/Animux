import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assuming you have a DB connection

// ---- Types ----

export interface StreamSource {
  id?: string;
  url: string;
  bitrate: number;
  resolution: string;
  kind?: 'sub' | 'dub';
  language?: string;
  audioLang?: string;
  label?: string;
  type?: string; // e.g., 'hls' or 'mp4'
}

export interface SubtitleTrack {
  lang: string;
  label: string;
  url?: string;
}

export interface DrmConfig {
  type: 'widevine';
  keyId: string;
  certificateUrl?: string;
}

export interface StreamPayload {
  animeId: string;
  episodeId: string;
  streamUrl: string;
  sources?: StreamSource[];
  subtitles?: SubtitleTrack[];
  drmConfig?: DrmConfig | null;
  duration?: number; // Add this at the top level
  meta?: {
    title: string;
    thumbnail: string;
    duration?: number; // Optional: if you still want it in meta
  };
  chapters?: {
    intro: [number, number] | null;
    recap: [number, number] | null;
  };
  duration?: number; // Add this line
}

// ---- Route ----

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get('animeId');
  const episodeId = searchParams.get('episodeId');

  if (!animeId || !episodeId) {
    return NextResponse.json(
      { error: 'Missing animeId or episodeId' },
      { status: 400 }
    );
  }

  try {
    // A. Try fetching from 4anime external source first
    const fourAnimeData = await fetchFrom4Anime(episodeId);
    
    if (fourAnimeData) {
      const sources: StreamSource[] = [
        {
          url: fourAnimeData.streamUrl,
          bitrate: 0,
          resolution: 'auto',
          type: 'hls',
        },
      ];

      return NextResponse.json({
        success: true,
        data: {
          animeId,
          episodeId,
          streamUrl: fourAnimeData.streamUrl,
          sources,
          subtitles: fourAnimeData.subtitles,
          drmConfig: null,
          meta: {
  title: fourAnimeData.title,
  thumbnail: fourAnimeData.thumbnail,
  duration: fourAnimeData.duration, // Add this line here
},
        } satisfies StreamPayload,
      });
    }

    // B. Fallback to Prisma Database
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: {
        streamUrl: true,
        drmKey: true,
        subtitles: true,
        quality: true,
        bitrate: true,
        title: true,
        duration: true,
        thumbnail: true,
      },
    });

    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    // C. Validate Stream URL (Ping the CDN)
    const isAccessible = await checkStreamHealth(episode.streamUrl);
    if (!isAccessible) {
      return NextResponse.json(
        { error: 'Stream temporarily unavailable', retryAfter: 30 },
        { status: 503 }
      );
    }

    // D. Normalize subtitles into SubtitleTrack[] shape
    const subtitles: SubtitleTrack[] = normalizeSubtitles(episode.subtitles);

    // E. Build sources[] array
    const sources: StreamSource[] = [
      {
        url: episode.streamUrl,
        bitrate: episode.bitrate ?? 0,
        resolution: episode.quality ?? 'auto',
        type: 'hls',
      },
    ];

    // F. Return Secure Stream Data
    return NextResponse.json({
      success: true,
      data: {
        animeId,
        episodeId,
        streamUrl: episode.streamUrl,
        sources,
        subtitles,
        drmConfig: buildDrmConfig(episode.drmKey),
        meta: {
          title: episode.title,
          duration: episode.duration,
          thumbnail: episode.thumbnail,
        },
      } satisfies StreamPayload,
    });
  } catch (error) {
    console.error('Stream API Error:', error);
    return NextResponse.json(
      { error: 'Internal stream resolution error' },
      { status: 500 }
    );
  }
}

// ---- Helpers ----

async function fetchFrom4Anime(
  episodeId: string
): Promise<{ streamUrl: string; subtitles: SubtitleTrack[]; title: string; duration: number; thumbnail: string } | null> {
  try {
    const response = await fetch(`https://api.4anime.gg/api/episode?id=${episodeId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://4anime.to/',
      },
    });

    if (!response.ok) return null;
    const data = await response.json();

    const firstSource = data?.sources?.[0];
    if (!firstSource || !firstSource.url) return null;

    return {
      streamUrl: firstSource.url,
      subtitles: Array.isArray(data?.subtitles)
        ? data.subtitles.map((sub: Record<string, unknown>) => ({
            lang: String(sub.lang ?? sub.language ?? 'unknown'),
            label: String(sub.label ?? sub.lang ?? 'Unknown'),
            url: sub.url ? String(sub.url) : undefined,
          }))
        : [],
      title: data?.title || 'Unknown',
      duration: data?.duration || 0,
      thumbnail: data?.thumbnail || '',
    };
  } catch (error) {
    console.error('Error fetching from 4anime:', error);
    return null;
  }
}

async function checkStreamHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      next: { revalidate: 0 },
    });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}

function buildDrmConfig(drmKey: unknown): DrmConfig | null {
  if (!drmKey) return null;

  if (typeof drmKey === 'string') {
    return { type: 'widevine', keyId: drmKey };
  }

  if (typeof drmKey === 'object' && drmKey !== null) {
    const obj = drmKey as Record<string, unknown>;
    return {
      type: 'widevine',
      keyId: String(obj.keyId ?? ''),
      certificateUrl: obj.certUrl ? String(obj.certUrl) : undefined,
    };
  }

  return null;
}

function normalizeSubtitles(subtitles: unknown): SubtitleTrack[] {
  if (!subtitles) return [];
  if (!Array.isArray(subtitles)) return [];

  return subtitles
    .map((s): SubtitleTrack | null => {
      if (typeof s === 'string') {
        return { lang: s, label: s };
      }
      if (typeof s === 'object' && s !== null) {
        const obj = s as Record<string, unknown>;
        return {
          lang: String(obj.lang ?? obj.language ?? 'unknown'),
          label: String(obj.label ?? obj.lang ?? 'Subtitle'),
          url: obj.url ? String(obj.url) : undefined,
        };
      }
      return null;
    })
    .filter((s): s is SubtitleTrack => s !== null);
}
