import { type ProviderEpisodeSources } from './types';

/**
 * ani.megaplay.su, addressed directly.
 *
 * A player *page* meant for an iframe, keyed by AniList id at
 * /ani/{anilistId}/{episode}/{sub|dub} (it also answers /mal/{malId}/… , but
 * this app is AniList-native, so the AniList route is the one used — no
 * catalogue search, and it cannot resolve to the wrong season). There is no
 * JSON endpoint and no video URL to extract; the page carries its own player.
 *
 * A distinct host from megaplay.buzz (see megaplay.ts) with a different URL
 * scheme, so it lives in its own module rather than sharing that one's.
 *
 * Embed-only here: the page is loaded by the viewer's browser, not fetched by
 * this server. That is the point — these hosts routinely refuse datacentre
 * addresses while serving a home connection perfectly, so the frame can play
 * when every server-side route has been refused. What it costs is everything
 * the app's own player does: quality switching, subtitle styling, skip-intro
 * and resume all stop at the frame boundary.
 */

const BASE = (process.env.MEGAPLAYSU_URL || 'https://ani.megaplay.su').replace(/\/+$/, '');

export function megaplaySuConfigured(): boolean {
  return process.env.MEGAPLAYSU_ENABLED !== '0';
}

/** The frame URL for one episode and audio track. */
export function megaplaySuEmbedUrl(anilistId: number, episode: number, audio: 'sub' | 'dub'): string {
  // autoplay: the viewer opened the player on purpose, so start playing.
  return `${BASE}/ani/${anilistId}/${episode}/${audio}?autoplay=true`;
}

/**
 * The episode as a player page, handed straight to the browser.
 *
 * Nothing is fetched here, and that is deliberate rather than lazy. Checking
 * the page first would reintroduce exactly the failure this path exists to
 * route around: the check runs from the server, and a host that refuses the
 * server would fail the check while serving the viewer's own connection
 * perfectly. Offering it unverified is what makes it useful — an iframe that
 * loads an error page is a visible, recoverable outcome rather than a silent one.
 */
export function megaplaySuEmbed(
  anilistId: number,
  episode: number,
  audio: 'sub' | 'dub',
): ProviderEpisodeSources {
  return {
    sources: [{
      url: megaplaySuEmbedUrl(anilistId, episode, audio),
      quality: 'auto',
      isM3U8: false,
      isEmbed: true,
    }],
    subtitles: [],
  };
}
