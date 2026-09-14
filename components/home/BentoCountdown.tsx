'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The only interactive piece of the gallery: a live "next episode in" clock.
 * Isolated into its own client component so the rest of the bento stays a
 * Server Component and ships no JavaScript. Ticks off the server-provided
 * seconds-until-airing, and stops itself under prefers-reduced-motion.
 */
export function BentoCountdown({ seconds }: { seconds: number }) {
  const target = useRef(Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, Math.round((target.current - Date.now()) / 1000)));
    tick();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells: [string, string][] = d > 0
    ? [[String(d), 'days'], [pad(h), 'hrs'], [pad(m), 'min']]
    : [[pad(h), 'hrs'], [pad(m), 'min'], [pad(s), 'sec']];

  return (
    <div className="mt-2 flex gap-1.5">
      {cells.map(([v, label]) => (
        <div key={label} className="flex-1 rounded-key bg-ink-950/60 py-1.5 text-center">
          <b className="block font-mono text-lead font-bold tabular-nums text-paper">{v}</b>
          <small className="text-micro uppercase tracking-wide text-haze/70">{label}</small>
        </div>
      ))}
    </div>
  );
}
