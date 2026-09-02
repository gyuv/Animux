/** Small display helpers. Kept apart from components so they stay testable. */

export function stripHtml(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|quot|#039|mdash|ldquo|rdquo);/g, (_, e) =>
      ({ nbsp: ' ', amp: '&', quot: '"', '#039': "'", mdash: '—', ldquo: '"', rdquo: '"' } as Record<string, string>)[e] ?? ' ',
    )
    .replace(/\s+/g, ' ')
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

export function airingIn(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `Next episode in ${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `Next episode in ${h}h ${m}m` : `Next episode in ${m}m`;
}

export function season(s?: string | null, year?: number | null): string {
  if (!s && !year) return '';
  const pretty = s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
  return [pretty, year].filter(Boolean).join(' ');
}
