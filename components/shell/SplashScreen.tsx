'use client';

import { useEffect, useState } from 'react';

/**
 * A one-shot boot animation, not a loading state — it does not wait on any
 * network request and never blocks the page underneath, which is already
 * rendering behind it. It exists purely to make the first paint of a cold
 * load feel considered rather than abrupt, the way a title card does before
 * an episode rather than cutting straight to cold open.
 *
 * Dismisses itself on a timer, or the instant the viewer interacts —
 * nobody who taps through an intro wants to sit out the rest of it.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('gone');
      return;
    }

    const dismiss = () => setPhase((p) => (p === 'in' ? 'out' : p));
    const timer = setTimeout(dismiss, 1350);

    window.addEventListener('pointerdown', dismiss, { once: true });
    window.addEventListener('keydown', dismiss, { once: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'out') return;
    const timer = setTimeout(() => setPhase('gone'), 500);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] grid place-items-center bg-ink-900 transition-opacity duration-500
                  ${phase === 'out' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="relative flex flex-col items-center">
        <span
          className="glow-pulse absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2
                     rounded-full bg-chroma/40 blur-3xl"
        />
        <span className="relative animate-scale-in font-display text-6xl font-black leading-none tracking-tight text-paper">
          a<span className="text-chroma">x</span>
        </span>
        <span className="relative mt-5 h-[3px] w-28 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-full origin-left animate-[splashBar_1.1s_var(--ease-physical)_forwards] bg-chroma" />
        </span>
      </div>
    </div>
  );
}
