'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * The last line of defence. It says what to try next rather than printing a
 * stack trace at someone who wanted to watch something.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server digests are the only handle on what actually failed in production.
    console.error('Animux route error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="gutter-x grid min-h-svh place-items-center">
      <div className="max-w-[44ch] text-center">
        <h1 className="font-display text-title font-bold text-paper">Something went wrong here</h1>
        <p className="mt-2 text-body text-haze">
          The page failed while it was loading. Trying again usually clears it — the
          catalogue this app reads from is a free API that occasionally refuses requests.
        </p>
        {error.digest && (
          <p className="mt-3 text-micro text-haze/60">Reference {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="key-primary">Try again</button>
          <Link href="/" className="key-ghost">Back to home</Link>
        </div>
      </div>
    </div>
  );
}
