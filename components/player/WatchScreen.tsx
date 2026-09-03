'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useChroma } from '@/hooks/useChroma';
import { Player } from './Player';

/**
 * Client-only boundary around the player.
 *
 * Almost everything the player renders depends on something the server cannot
 * know: the viewer's stored volume and speed, whether this browser supports
 * picture-in-picture, how far into the episode they were. Rendering it on the
 * server and then correcting it on hydration produced exactly the mismatch
 * React warns about, so the player waits for the client instead — it needs the
 * DOM to do anything useful anyway, and there is nothing here worth indexing.
 */
export function WatchScreen(props: React.ComponentProps<typeof Player>) {
  const [mounted, setMounted] = useState(false);
  useChroma(props.color);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="relative grid min-h-svh place-items-center bg-black">
        {props.cover && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={props.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="relative text-center">
          <Loader2 size={34} className="mx-auto animate-spin text-paper/80" aria-hidden />
          <p className="mt-4 text-meta text-haze">
            {props.title} — episode {props.episode}
          </p>
        </div>
      </div>
    );
  }

  return <Player {...props} />;
}
