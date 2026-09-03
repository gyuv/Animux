export interface AnimeStream {
  id: string;
  label: string;
  url: string;
  type: "hls" | "mp4";
  audioLang: string;
  kind: "sub" | "dub";
}

export interface AnimeStreamResult {
  sources: AnimeStream[];
  subtitles: {
    lang: string;
    label: string;
    url: string;
    default?: boolean;
  }[];
  chapters: {
    intro?: [number, number];
    outro?: [number, number];
  };
  duration: number | null;
}

export async function getAnimeStreams(
  animeId: string,
  episode: number,
): Promise<AnimeStreamResult> {
  const provider = process.env.STREAM_PROVIDER_URL;

  if (!provider) {
    throw new Error("STREAM_PROVIDER_URL is not configured");
  }

  const response = await fetch(
    `${provider}?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(
      String(episode),
    )}`,
  );

  if (!response.ok) {
    throw new Error("Stream provider failed");
  }

  const data = await response.json();

  return {
    sources: data.sources ?? [],
    subtitles: data.subtitles ?? [],
    chapters: data.chapters ?? {},
    duration: data.duration ?? null,
  };
}
