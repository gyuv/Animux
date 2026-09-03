/** Small display helpers. Kept apart from components so they stay testable. */

import type { FuzzyDate } from '@/services/anilist';

export function stripHtml(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|quot|lt|gt|#039|apos|mdash|ndash|ldquo|rdquo|hellip);/g, (_, e) =>
      ({
        nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', '#039': "'", apos: "'",
        mdash: '—', ndash: '–', ldquo: '“', rdquo: '”', hellip: '…',
      } as Record<string, string>)[e] ?? ' ',
    )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 3725 -> "1:02:05", 145 -> "2:25". Used by the player. */
export function timecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "How much is left", written the way a viewer would say it. */
export function remaining(position: number, duration: number): string {
  const left = Math.max(0, duration - position);
  if (left < 60) return 'Almost done';
  return `${Math.round(left / 60)} min left`;
}

/** Compact countdown for badges: "2d 4h", "18m". */
export function countdown(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function airingIn(seconds?: number | null): string | null {
  const c = countdown(seconds);
  return c ? `Next episode in ${c}` : null;
}

export function season(s?: string | null, year?: number | null): string {
  if (!s && !year) return '';
  const pretty = s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
  return [pretty, year].filter(Boolean).join(' ');
}

/** 1_284_302 -> "1.3M". Popularity and favourite counts get long. */
export function compact(n?: number | null): string {
  if (n === null || n === undefined) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** AniList dates are fuzzy — any part can be missing. Render what exists. */
export function fuzzyDate(d?: FuzzyDate | null): string | null {
  if (!d || !d.year) return null;
  if (!d.month) return String(d.year);
  const month = MONTHS[d.month - 1] ?? '';
  return d.day ? `${month} ${d.day}, ${d.year}` : `${month} ${d.year}`;
}

export function dateRange(start?: FuzzyDate | null, end?: FuzzyDate | null): string | null {
  const a = fuzzyDate(start);
  if (!a) return null;
  const b = fuzzyDate(end);
  if (!b) return `${a} — ongoing`;
  return a === b ? a : `${a} — ${b}`;
}

/** Weekday + local clock time for an airing timestamp. */
export function airTime(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/* ---------------------------------------------- AniList enum prettifiers */

const TITLE_CASE = (s: string) =>
  s.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function formatLabel(format?: string | null): string {
  if (!format) return '—';
  return (
    {
      TV: 'TV series',
      TV_SHORT: 'TV short',
      MOVIE: 'Film',
      SPECIAL: 'Special',
      OVA: 'OVA',
      ONA: 'ONA',
      MUSIC: 'Music video',
    } as Record<string, string>
  )[format] ?? TITLE_CASE(format);
}

export function statusLabel(status?: string | null): string {
  if (!status) return '—';
  return (
    {
      FINISHED: 'Finished',
      RELEASING: 'Airing',
      NOT_YET_RELEASED: 'Announced',
      CANCELLED: 'Cancelled',
      HIATUS: 'On hiatus',
    } as Record<string, string>
  )[status] ?? TITLE_CASE(status);
}

export function sourceLabel(source?: string | null): string | null {
  if (!source) return null;
  return (
    {
      ORIGINAL: 'Original work',
      MANGA: 'Manga',
      LIGHT_NOVEL: 'Light novel',
      VISUAL_NOVEL: 'Visual novel',
      VIDEO_GAME: 'Video game',
      NOVEL: 'Novel',
      DOUJINSHI: 'Doujinshi',
      ANIME: 'Anime',
      WEB_NOVEL: 'Web novel',
      LIVE_ACTION: 'Live action',
      GAME: 'Game',
      COMIC: 'Comic',
      MULTIMEDIA_PROJECT: 'Multimedia project',
      PICTURE_BOOK: 'Picture book',
    } as Record<string, string>
  )[source] ?? TITLE_CASE(source);
}

export function relationLabel(relation?: string | null): string {
  if (!relation) return 'Related';
  return (
    {
      ADAPTATION: 'Adaptation',
      PREQUEL: 'Prequel',
      SEQUEL: 'Sequel',
      PARENT: 'Parent story',
      SIDE_STORY: 'Side story',
      CHARACTER: 'Shares characters',
      SUMMARY: 'Summary',
      ALTERNATIVE: 'Alternative',
      SPIN_OFF: 'Spin-off',
      OTHER: 'Other',
      SOURCE: 'Source',
      COMPILATION: 'Compilation',
      CONTAINS: 'Contains',
    } as Record<string, string>
  )[relation] ?? TITLE_CASE(relation);
}

export function watchStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return (
    {
      CURRENT: 'Watching',
      PLANNING: 'Planning',
      COMPLETED: 'Completed',
      DROPPED: 'Dropped',
      PAUSED: 'Paused',
      REPEATING: 'Rewatching',
    } as Record<string, string>
  )[status] ?? TITLE_CASE(status);
}

export function countryLabel(code?: string | null): string | null {
  if (!code) return null;
  return ({ JP: 'Japan', CN: 'China', KR: 'South Korea', TW: 'Taiwan' } as Record<string, string>)[code] ?? code;
}

export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return ({ MAIN: 'Main', SUPPORTING: 'Supporting', BACKGROUND: 'Background' } as Record<string, string>)[role] ?? TITLE_CASE(role);
}
