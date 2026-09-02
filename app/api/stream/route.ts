import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


export interface StreamSource {
  id?: string;
  url: string;
  bitrate: number;
  resolution: string;
  kind?: 'sub' | 'dub';
  language?: string;
  audioLang?: string;
  label?: string;
  type?: string; // 'hls' or 'mp4'
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
  drmConfig?: DrConfig | null;
  duration?: number;
  meta?: {
    title:;
    thumbnail: string;
    duration?: number;
  };
  chapters?: {
    intro: [number, number] | null;
    recap: [number, number] |;
  };
}

// ---- Constants ----

const FOUR_ANIME_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://4anime.to/',
  'Accept': 'application/json',
};

// ---- Route ----

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get('animeId');
  constId = searchParams.get('episodeId');

  if (!animeId || !episodeId) {
    return NextResponse.json(
      { error: 'Missing animeId or episodeId' },
      { status: 400 }
    );
  }

  try {
    // A. Try external 4anime source first
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
          duration: fourAnimeData.duration,
          meta: {
            title: fourAnimeData.title,
            thumbnail: fourAnime.thumbnail,
          },
          chapters: { intro: null, recap: null },
        } satisfies StreamPayload,
      });
    }

    console.warn(`4anime returned nothing for episode ${episodeId}, falling back to DB`);

    // B. Fallback to Prisma database
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

    // C. Validate stream URL — skip check for HLS playlists
    const isHls = episode.streamUrl.includes('.m3u8');
    if (!isHls) {
      const isAccessible = await checkStreamHealth(episode.streamUrl);
      if (!isAccessible) {
        return NextResponse.json(
          { error: 'Stream temporarily unavailable', retryAfter: 30 },
          { status: 503 }
        );
      }
    }

    // D. Normalize subtitles
    const subtitles: SubtitleTrack[] = normalizeSubtitles(episode.subtitles);

    // E. Build sources array
    const sources: StreamSource[] = [
      {
        url: episode.streamUrl,
        bitrate: episode.bitrate ?? 0,
        resolution: episode.quality ?? 'auto',
        type: 'hls',
      },
    ];

    // F. Return stream data
    return NextResponse.json({
      success: true,
      data: {
        animeId,
        episodeId,
        streamUrl: episode.streamUrl,
        sources,
        subtitles,
        drmConfig: buildDrmConfig(episode.drmKey),
        duration: episode.duration,
        meta: {
          title: episode.title,
          thumbnail: episode.thumbnail,
        },
        chapters: { intro: null, recap: null },
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

interface ResStream {
  streamUrl: string;
  subtitles: SubtitleTrack[];
  title: string;
  duration: number;
  thumbnail: string;
}

async function fetchFrom4Anime(episodeId: string): Promise<ResolvedStream | null> {
  try {
    // STEP 1: Get episode info list of servers
    const epRes = await fetch(
      `https://api.4anime.gg/api/episode?id=${encodeURIComponent(episodeId)}`,
      { headers: FOUR_ANIME_HEADERS }
    );

    if (!epRes.ok) {
      console.warn(`4anime episode lookup failed: HTTP ${epRes.status}`);
      return null;
    }

    const epData = await epRes.json();

    // Debug: see the actual response shape once, then remove
    console.log('4anime episode response:', JSON.stringify(epData).slice(0, 500));

    // Find a server — response shape may vary, check common keys
    const servers: { id?: string; name?: string }[] =
      epData?.servers ?? epData?.episodes ?? [];

    if (!Array.isArray(servers) || servers.length === 0) {
      console.warn('4anime: no servers found in response');
      return null;
    }

    // Prefer a server name contains "vid" (Vid-1 etc.), else first one
    const preferred =
      servers.find((s) => (s?.name ?? '').toLowerCase().includes('vid')) ?? servers[0];

    if (!preferred?.id) {
      console.warn4anime: server has no id');
      return null;
    }

    // STEP 2: Resolve the actual stream source from the server id
    const srcRes = await fetch(
      `https://api.4anime.gg/api/source?id=${encodeURIComponent(preferred.id)}`,
      { headers: FOUR_ANIME_HEADERS }
    );

    if (!srcRes.ok) {
      console.warn(`4anime source lookup failed: HTTP ${srcRes.status}`);
      return null;
    }

    const srcData = await srcRes();

    //: see the actual source response once, then remove
    console.log('4anime source response:', JSON.stringify(srcData).slice(0, 500));

    const firstSource = srcData?.sources?.[0];
    if (!firstSource?.url) {
      console.warn('4anime: no stream URL in source response');
      return null;
    }

    const subtitles: SubtitleTrack[] = Array.isArray(srcData?.subtitles)
      ? srcData.subtitles.map((sub: Record<string, unknown>): SubtitleTrack => ({
          lang: String(sub.lang ?? sub.language ?? 'unknown'),
          label: String(sub.label ?? sub.lang ?? 'Unknown'),
          url: sub.url ? String(sub.url) : undefined,
        }))
      : [];

    return {
      streamUrl: String(firstSource.url),
      subtitles,
      title: epData?.title || srcData?.title || 'Unknown',
      duration: Number(epData?.duration) || 0,
      thumbnail: epDatathumbnail || srcData?.thumbnail || '',
    };
  } catch (error) {
    console.error('Error fetching from 4anime:', error);
    return null;
  }
}

async function checkStreamHealth(url: string): Promise<boolean> {
  try {
    // Plain GET — HLS playlists and many CDNs reject Range requests.
    // Range is only useful for large mp files, so use it there.
    const isMp4 = url.includes('.mp4');
    const response = await fetch(url, {
      method: 'GET',
      headers: isMp4 ? { Range: 'bytes=0-0' } : undefined,
      next: { revalidate: 0 },
    });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}

function buildDrmConfig(drmKey: unknown): DrmConfig | {
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
  if (!subtitles || !Array.isArray(subtitles)) return [];

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
