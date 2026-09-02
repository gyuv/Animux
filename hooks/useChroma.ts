'use client';

import { useEffect } from 'react';
import { toChromaVar } from '@/lib/chroma';

/**
 * Publishes a title's artwork colour to the document so the whole interface
 * — focus rings, glows, progress — tints to whatever is on screen.
 * Pass null on unmount-ish transitions to fall back to neutral.
 */
export function useChroma(hex?: string | null) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--chroma');
    root.style.setProperty('--chroma', toChromaVar(hex));
    return () => {
      root.style.setProperty('--chroma', previous || '182 173 200');
    };
  }, [hex]);
}
