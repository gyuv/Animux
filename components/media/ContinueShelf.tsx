'use client';

import { useEffect, useState } from 'react';
import { useLibrary } from '@/store/useLibrary';
import { Rail } from './Rail';
import { ContinueCard } from './ContinueCard';

/**
 * Reads from persisted local state, so it renders nothing on the server and
 * nothing on the first client paint. Mounting behind a flag avoids the
 * hydration mismatch you get when localStorage disagrees with the HTML.
 */
export function ContinueShelf() {
  const [mounted, setMounted] = useState(false);
  const progress = useLibrary((s) => s.progress);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const entries = progress
    .filter((p) => {
      const ratio = p.duration > 0 ? p.position / p.duration : 0;
      return ratio > 0.02 && ratio < 0.92;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (entries.length === 0) return null;

  return (
    <Rail title="Pick up where you left off">
      {entries.map((entry) => (
        <ContinueCard key={`${entry.animeId}:${entry.episode}`} entry={entry} />
      ))}
    </Rail>
  );
}
