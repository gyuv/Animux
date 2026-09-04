/**
 * The AniHeist servers a viewer may pick between.
 *
 * Split out from the adapter because the player's menu needs this list in the
 * browser, and the adapter is all server-side fetching — importing one to get
 * the other would ship the whole client for four strings.
 *
 * `source=miruro` is pinned on every entry by the adapter, deliberately. Left
 * to itself the API prefers its `anikoto` backend, which answers with
 * `format: "embed"` — a player *page* meant for an iframe, not a video URL.
 * Handing that to hls.js gets a manifest error at best and a spinner that
 * never resolves at worst. The miruro backend is the one returning direct HLS
 * and MP4, which is what this player consumes.
 */

export interface AniheistServer {
  id: string;
  label: string;
  /** Sent as `provider=`; absent means the API picks, in its own order. */
  provider?: string;
  note: string;
}

/**
 * `pewe` is the server this integration was added for. AniHeist's own
 * documentation marks it intermittent — it resolves through anidb.app — which
 * is exactly why it earns a named entry rather than a silent link in a
 * fallback chain: when it fails the viewer knows *which* server failed, and
 * can pick another instead of concluding the app is broken.
 */
export const ANIHEIST_SERVERS: AniheistServer[] = [
  { id: 'auto', label: 'Auto', note: 'Tries each server in turn' },
  { id: 'pewe', label: 'Pewe', provider: 'pewe', note: 'anidb.app · intermittent' },
  { id: 'ally', label: 'Ally', provider: 'ally', note: 'wixmp.com · direct HLS' },
  { id: 'moo', label: 'Moo', provider: 'moo', note: 'animegg.org · direct MP4' },
];

export function aniheistServer(id: string | null | undefined): AniheistServer | null {
  return ANIHEIST_SERVERS.find((s) => s.id === id) ?? null;
}
