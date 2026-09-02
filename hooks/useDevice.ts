'use client';

import { useEffect, useState } from 'react';

export type Device = 'mobile' | 'desktop' | 'tv';

/**
 * Decides which of the three form factors we are on and writes it to
 * <html data-device>. Everything else — type scale, gutters, nav shape,
 * focus weight — keys off that one attribute.
 *
 * TV detection: a real remote-driven session almost never reports a touch
 * point and almost always sits on a very wide viewport, so we combine
 * viewport width with a user-agent check for the common TV platforms and
 * an explicit override for when this is wrapped in a native shell.
 */
export function useDevice(): Device {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    const decide = (): Device => {
      // A native wrapper (Android TV / Fire TV WebView) can force the mode.
      const forced = (window as any).__ANIMUX_DEVICE__ as Device | undefined;
      if (forced) return forced;

      const ua = navigator.userAgent.toLowerCase();
      const looksLikeTv =
        /\b(smart-?tv|smarttv|googletv|appletv|hbbtv|netcast|viera|webos|tizen|bravia|aftb|aftt|crkey)\b/.test(ua);

      if (looksLikeTv) return 'tv';
      if (window.innerWidth >= 1600 && !window.matchMedia('(pointer: fine)').matches) return 'tv';
      if (window.innerWidth < 768) return 'mobile';
      return 'desktop';
    };

    const apply = () => {
      const next = decide();
      setDevice(next);
      document.documentElement.dataset.device = next;
    };

    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  return device;
}
