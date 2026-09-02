'use client';

import { useEffect, useState } from 'react';
import { Splash } from './Splash';

/**
 * Decides whether the opening plays.
 *
 * It plays once per browser session — on the first load, not on every route
 * change and not on every visit that day. A brand moment that repeats stops
 * being a brand moment and becomes a toll booth.
 *
 * The app renders underneath throughout. This is an overlay, never a gate on
 * content, so a viewer who deep-links to a title is never made to wait for an
 * animation about a logo they did not ask to see.
 */

const SEEN_KEY = 'animux:intro-seen';

export function SplashGate() {
  // Starts false so the server and first client render agree; the effect
  // decides. Showing nothing briefly is better than a hydration mismatch.
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // Private browsing can throw on storage access. Treat it as unseen.
    }

    // Skip the intro for anyone arriving mid-app, e.g. a shared title link.
    const deepLink = window.location.pathname !== '/';

    if (!seen && !deepLink) {
      setShowing(true);
      document.documentElement.setAttribute('data-intro', 'running');
    }
  }, []);

  const finish = () => {
    setShowing(false);
    document.documentElement.removeAttribute('data-intro');
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* Nothing to do; it will simply play again next load. */
    }
  };

  if (!showing) return null;
  return <Splash onDone={finish} />;
}
