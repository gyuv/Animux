'use client';

import { useEffect, useState } from 'react';

/**
 * The Animux opening.
 *
 * The shape of this comes from the wordmark rather than being applied to it.
 * `AppShell` already treats the x as the brand device — it is the one glyph the
 * name gives us for free, and it reads as a play head. So the intro does not
 * fade a logo in: two beams of light sweep from opposite corners and cross, and
 * the crossing *is* the x. The rest of the name assembles around it.
 *
 * One orchestrated moment, then it gets out of the way. There is no spinner and
 * no tagline, because neither tells the viewer anything they need.
 *
 * It never blocks: the app renders underneath from the first frame, and this
 * layer removes itself on a timer, on click, or on Escape. If anything about
 * the sequence fails, the worst case is a dark overlay that still dismisses.
 */

const RUN_MS = 2600;
const REDUCED_MS = 900;

export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const total = reduced ? REDUCED_MS : RUN_MS;

    const exit = window.setTimeout(() => setLeaving(true), total - 500);
    const done = window.setTimeout(onDone, total);

    // Anyone who has seen it once should be able to skip it instantly.
    const skip = () => {
      setLeaving(true);
      window.setTimeout(onDone, 220);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(done);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  return (
    <div
      className={`splash ${leaving ? 'splash-out' : ''}`}
      role="status"
      onClick={() => setLeaving(true)}
    >
      {/* The two beams. They cross dead centre, and the crossing becomes the x. */}
      <div className="splash-beam splash-beam-a" aria-hidden />
      <div className="splash-beam splash-beam-b" aria-hidden />

      {/* The flash at the moment of crossing. */}
      <div className="splash-bloom" aria-hidden />

      <div className="splash-word" aria-hidden>
        {/* Held back until the x exists, then wiped in from the left. */}
        <span className="splash-stem">animu</span>
        <span className="splash-x">x</span>
      </div>

      {/* A single pass of light across the finished wordmark. */}
      <div className="splash-scan" aria-hidden />

      <span className="sr-only">Loading Animux</span>
    </div>
  );
}
