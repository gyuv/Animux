/**
 * The shape every provider adapter resolves to, before it is turned into the
 * player's `StreamPayload`. Keeping this separate from the route's own types
 * means adding a third provider is one file, not a rewrite.
 */

export interface ProviderSource {
  url: string;
  /** Provider labels are inconsistent: "1080p", "default", "auto", "backup". */
  quality: string;
  isM3U8: boolean;
}

export interface ProviderSubtitle {
  url: string;
  /** As the provider spells it — "English", "en", "Portuguese - Brazil". */
  lang: string;
}

export interface ProviderEpisodeSources {
  sources: ProviderSource[];
  subtitles: ProviderSubtitle[];
  /** Seconds. Providers report these inconsistently; zeros mean "unknown". */
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  /** Headers the CDN requires — in practice always just Referer. */
  referer?: string;
}

export interface ProviderEpisode {
  /** The provider's own episode id, opaque to us. */
  id: string;
  number: number;
  title: string | null;
  image: string | null;
  description: string | null;
  isFiller?: boolean;
}

export class ProviderError extends Error {
  readonly viewerMessage: string;

  constructor(viewerMessage: string, detail?: string) {
    super(detail ?? viewerMessage);
    this.name = 'ProviderError';
    this.viewerMessage = viewerMessage;
  }
}

/** Shared fetch with a timeout — a hung provider must not hang the route. */
export async function providerFetch(url: string, timeoutMs = 12_000): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
  } catch (err) {
    throw new ProviderError(
      'The streaming service did not respond.',
      err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    );
  }

  if (res.status === 404) {
    throw new ProviderError('That episode is not available from this source.', 'HTTP 404');
  }
  if (!res.ok) {
    throw new ProviderError('The streaming service returned an error.', `HTTP ${res.status}`);
  }

  return res.json().catch(() => {
    throw new ProviderError('The streaming service sent something unreadable.');
  });
}

/** Providers disagree on how to spell a language; the player wants BCP-47. */
export function toLangCode(label: string): string {
  const key = label.trim().toLowerCase().split(/[\s-]/)[0];
  return (
    {
      english: 'en', eng: 'en',
      japanese: 'ja', jpn: 'ja',
      spanish: 'es', castilian: 'es',
      portuguese: 'pt',
      french: 'fr',
      german: 'de',
      italian: 'it',
      arabic: 'ar',
      russian: 'ru',
      hindi: 'hi',
      indonesian: 'id',
      thai: 'th',
      turkish: 'tr',
      polish: 'pl',
      chinese: 'zh', mandarin: 'zh',
      korean: 'ko',
    } as Record<string, string>
  )[key] ?? (key.length === 2 ? key : 'und');
}
