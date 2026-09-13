import { type ProviderEpisodeSources } from './types';

/**
 * embed.filmu.in, addressed directly.
 *
 * The URL scheme is the whole API: /anime/{anilistId}/{season}/{episode}
 * returns a player *page* meant for an iframe — there is no JSON endpoint and
 * no video URL to extract. Like Vega it is keyed by AniList id, so it needs no
 * catalogue search and cannot resolve to the wrong season.
 *
 * AniList models every season as its own entry, so the id already pins the
 * season; the season segment is therefore always 1 and the episode is the
 * episode number within that entry.
 *
 * This is an embed-only source: the page is loaded by the viewer's browser,
 * not fetched here. That is the point of it — these hosts routinely refuse
 * datacentre addresses while serving a home connection perfectly, so the frame
 * can play an episode every server-side route has been refused. What it costs
 * is everything the app's own player does: quality switching, subtitle
 * styling, skip-intro and resume all stop at the frame boundary.
 */

const BASE = (process.env.FILMU_URL || 'https://embed.filmu.in').replace(/\/+$/, '');

export function filmuConfigured(): boolean {
  return process.env.FILMU_ENABLED !== '0';
}

/** The frame URL for one episode. */
export function filmuEmbedUrl(anilistId: number, episode: number): string {
  // Season is always 1: an AniList id already identifies a single season.
  return `${BASE}/anime/${anilistId}/1/${episode}`;
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
export function filmuEmbed(anilistId: number, episode: number): ProviderEpisodeSources {
  return {
    sources: [{
      url: filmuEmbedUrl(anilistId, episode),
      quality: 'auto',
      isM3U8: false,
      isEmbed: true,
    }],
    subtitles: [],
  };
}
