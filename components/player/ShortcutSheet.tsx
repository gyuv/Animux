'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * The shortcuts, written down. Every player has them and almost none of them
 * say so, which means the people who would most benefit never find out.
 */
export function ShortcutSheet({
  open,
  onClose,
  seekStep,
}: {
  open: boolean;
  onClose: () => void;
  seekStep: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rows: [string, string][] = [
    ['Space  K', 'Play or pause'],
    ['← →', `Back or forward ${seekStep} seconds`],
    ['J L', `Back or forward ${seekStep} seconds`],
    ['0 – 9', 'Jump to that tenth of the episode'],
    ['↑ ↓', 'Volume'],
    ['M', 'Mute'],
    ['F', 'Full screen'],
    ['P', 'Picture in picture'],
    ['C', 'Audio, subtitles and quality'],
    ['< >', 'Slower or faster'],
    ['?', 'This list'],
  ];

  return (
    <div className="absolute inset-0 z-40 grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div className="glass relative w-full max-w-[420px] rounded-panel p-6 animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-title font-bold text-paper">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-haze transition-colors hover:bg-white/10 hover:text-paper"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <dl className="space-y-2.5">
          {rows.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between gap-4">
              <dt className="flex gap-1.5">
                {keys.split(/\s+/).map((k) => (
                  <kbd
                    key={k}
                    className="min-w-[26px] rounded border border-ink-600 bg-ink-800 px-1.5 py-1
                               text-center font-sans text-micro text-paper"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-right text-meta text-haze">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
