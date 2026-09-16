'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The "Domain Expansion" boot sequence — a one-shot animation, not a loading
 * state. It does not wait on any network request and never blocks the page
 * underneath, which is already rendering behind it. It exists purely to make
 * the first paint of a cold load feel considered rather than abrupt, the way
 * a title card does before an episode rather than cutting straight to cold
 * open: the mark charges up, discharges outward in a single pulse, and the
 * page is already sitting there waiting for it as it clears.
 *
 * Dismisses instantly on the first interaction — nobody who taps through an
 * intro wants to sit out the rest of it — and never even starts for
 * prefers-reduced-motion, rather than skipping through an animation whose
 * point is the motion.
 */
type Phase = 'charging' | 'ripple' | 'out' | 'gone';

const CHARGE_MS = 1000;
const RIPPLE_MS = 480;
const FADE_MS = 420;

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('charging');
  const dismissedEarly = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('gone');
      return;
    }

    const dismiss = () => {
      dismissedEarly.current = true;
      setPhase((p) => (p === 'charging' || p === 'ripple' ? 'out' : p));
    };

    const toRipple = setTimeout(() => setPhase((p) => (p === 'charging' ? 'ripple' : p)), CHARGE_MS);
    const toOut = setTimeout(() => setPhase((p) => (p === 'ripple' ? 'out' : p)), CHARGE_MS + RIPPLE_MS);

    window.addEventListener('pointerdown', dismiss, { once: true });
    window.addEventListener('keydown', dismiss, { once: true });

    return () => {
      clearTimeout(toRipple);
      clearTimeout(toOut);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'out') return;
    const timer = setTimeout(() => setPhase('gone'), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] grid place-items-center bg-ink-900 backdrop-blur-2xl
                  transition-opacity ease-physical
                  ${phase === 'out' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="relative flex flex-col items-center">
        {/* Dual-tone aura, violet under cyan — the same pairing the charge
            bar and ripple use, so the whole sequence reads as one light
            source rather than three unrelated effects. */}
        <span className="glow-pulse absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2
                          rounded-full bg-violet/30 blur-3xl" aria-hidden />
        <span className="glow-pulse absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2
                          rounded-full bg-cyan/20 blur-2xl [animation-delay:0.3s]" aria-hidden />

        {(phase === 'ripple' || phase === 'out') && !dismissedEarly.current && (
          <>
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2
                              animate-ripple rounded-full border-2 border-cyan" aria-hidden />
            <span className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2
                              animate-ripple rounded-full border-2 border-violet [animation-delay:0.15s]" aria-hidden />
          </>
        )}

        <span
          className="relative font-display text-6xl font-black leading-none tracking-tight text-paper"
          style={{ textShadow: '0 0 22px rgb(139 92 246 / 0.7)' }}
        >
          a
          <span className="text-cyan" style={{ textShadow: '0 0 18px rgb(0 242 254 / 0.85), 0 0 40px rgb(0 242 254 / 0.4)' }}>
            x
          </span>
        </span>

        <span className="relative mt-5 h-[3px] w-32 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full w-full origin-left animate-charge-bar rounded-full"
            style={{
              background: 'linear-gradient(90deg, #8B5CF6, #00F2FE)',
              boxShadow: '0 0 12px 1px rgb(0 242 254 / 0.6)',
              animationDuration: `${CHARGE_MS}ms`,
            }}
          />
        </span>
      </div>
    </div>
  );
}
