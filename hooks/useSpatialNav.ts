'use client';

import { useEffect } from 'react';

/**
 * D-pad navigation for TV remotes.
 *
 * The previous version walked a flat list of every focusable node in the
 * document and jumped by a hard-coded ±4 to move "down" — which broke the
 * moment the grid was not four columns wide, and happily focused things
 * that were off-screen.
 *
 * This one is geometric: it measures where elements actually are and moves
 * to the nearest candidate in the direction pressed, biased so that a press
 * of "down" strongly prefers something below rather than far to the side.
 */

const SELECTOR =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

type Dir = 'up' | 'down' | 'left' | 'right';

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

function pick(from: HTMLElement, dir: Dir): HTMLElement | null {
  const origin = centre(from);
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)).filter((el) => {
    if (el === from || el.offsetParent === null) return false;
    const { r } = centre(el);
    return r.width > 0 && r.height > 0;
  });

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    const c = centre(el);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;

    // Must actually lie in the requested direction, with a small dead zone
    // so near-aligned items don't register as diagonal moves.
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (along <= 8) continue;

    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);

    // Distance along the axis counts once; drift across it counts triple,
    // which keeps a "down" press inside the same column of a poster grid.
    const score = along + across * 3;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function useSpatialNav(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key];
      if (!dir) return;

      const active = document.activeElement as HTMLElement | null;

      // Let text fields and the seek bar own the arrow keys.
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.getAttribute('role') === 'slider' ||
          active.dataset.ownsArrows === 'true')
      ) {
        return;
      }

      if (!active || active === document.body) {
        document.querySelector<HTMLElement>(SELECTOR)?.focus();
        e.preventDefault();
        return;
      }

      const next = pick(active, dir);
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
