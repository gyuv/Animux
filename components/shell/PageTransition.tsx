'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * A route change gets two things: the incoming page rises in rather than
 * appearing mid-frame, and a slash of light sweeps across the exact instant
 * the swap happens, masking what would otherwise be an abrupt cut. There is
 * no exit animation for the page that is leaving — the App Router has
 * already replaced it in the tree by the time this runs, so there is
 * nothing left to animate out — the slash is what stands in for that,
 * covering the swap rather than choreographing it.
 *
 * Skipped on the very first paint (the boot splash already owns that
 * moment) and never fires for prefers-reduced-motion, where a page's whole
 * point is to be there, not to arrive.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [slash, setSlash] = useState(false);
  const first = useRef(true);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced.current) return;
    setSlash(true);
    const t = setTimeout(() => setSlash(false), 600);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      {slash && <SlashWipe />}
      <motion.div
        key={pathname}
        initial={reduced.current ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </>
  );
}

function SlashWipe() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[150] overflow-hidden" aria-hidden>
      <div
        className="absolute inset-y-0 left-0 w-[45%] animate-[slashSweep_0.55s_cubic-bezier(0.76,0,0.24,1)_forwards]"
        style={{
          background: 'linear-gradient(100deg, transparent, rgb(139 92 246 / 0.85) 40%, rgb(0 242 254 / 0.85) 60%, transparent)',
          filter: 'blur(1px)',
        }}
      />
    </div>
  );
}
