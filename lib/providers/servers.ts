/**
 * The servers a viewer picks between.
 *
 * Every name here is this app's own. The list deliberately does not leak which
 * upstream is behind each entry: the backend is an implementation detail that
 * changes when a scraper breaks, and a viewer who learned to ask for one by
 * its upstream's name would be left holding a name that no longer means
 * anything. One stable label per route through the stack is the contract.
 *
 * Kept free of any server-only imports, because the player's menu renders this
 * list in the browser and must not drag fetch code along with it.
 */

export type ServerBackend = 'aniheist' | 'megaplay' | 'reanime';

export interface StreamServer {
  /** Stable slug; appears in the API call and in stored preferences. */
  id: string;
  /** What the viewer reads. */
  label: string;
  /** One line under the label — capability, not provenance. */
  note: string;
  backend: ServerBackend;
  /** Backend-specific routing, opaque to the UI. */
  provider?: string;
  upstream?: 'HD-1' | 'HD-2';
  /** True when this entry only works once its service has been deployed. */
  needsDeploy?: boolean;
}

/**
 * Order is the fallback order for "Auto", best-first:
 *
 *   Vega needs nothing deployed and is keyed by AniList id, so it is both the
 *   cheapest and the one that cannot resolve to the wrong season.
 *   Orion/Lyra/Draco are the same shape behind one service.
 *   Nova/Atlas are last only because they are dark until their service is
 *   deployed — when it is, they are the ones carrying real subtitle tracks.
 */
export const SERVERS: StreamServer[] = [
  { id: 'vega',  label: 'Vega',  note: 'Direct HLS · sub and dub',      backend: 'megaplay' },
  { id: 'orion', label: 'Orion', note: 'Direct HLS',                    backend: 'aniheist', provider: 'ally' },
  { id: 'lyra',  label: 'Lyra',  note: 'Backup route · intermittent',   backend: 'aniheist', provider: 'pewe' },
  { id: 'draco', label: 'Draco', note: 'Progressive MP4',               backend: 'aniheist', provider: 'moo' },
  { id: 'nova',  label: 'Nova',  note: 'Subtitle tracks · needs setup', backend: 'reanime', upstream: 'HD-1', needsDeploy: true },
  { id: 'atlas', label: 'Atlas', note: 'Subtitle tracks · needs setup', backend: 'reanime', upstream: 'HD-2', needsDeploy: true },
];

/** The entry shown first, meaning "try them in order". */
export const AUTO_SERVER = { id: 'auto', label: 'Auto', note: 'Tries every server in turn' };

export function findServer(id: string | null | undefined): StreamServer | null {
  return SERVERS.find((s) => s.id === id) ?? null;
}
