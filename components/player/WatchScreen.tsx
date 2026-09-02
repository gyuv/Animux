'use client';

import { useChroma } from '@/hooks/useChroma';
import { Player } from './Player';

/** Thin client wrapper so the player page can stay a server component. */
export function WatchScreen(props: React.ComponentProps<typeof Player>) {
  useChroma(props.color);
  return <Player {...props} />;
}
