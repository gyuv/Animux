# Animux

An anime front end: browse a catalogue of ~20,000 titles, read everything
AniList knows about any one of them, and watch episodes with the audio and
subtitle track you actually want. Next.js 14 App Router, TypeScript, Tailwind.

```bash
npm install
npm run dev
```

Metadata comes from AniList's public GraphQL API — no key needed. Video does
not: see [Streaming sources](#streaming-sources).

---

## What is here

**Home.** A five-slide hero that advances on a timer and stops the moment you
touch it, a live "on air in the next 48 hours" strip counting down, a numbered
top-ten rail, this season, next season, films, and eight doors marked by mood.

**Title pages** are the centre of the app. Six tabbed sections, all rendered on
the server in one request:

| Section | What is in it |
| --- | --- |
| Overview | Synopsis, full production record, crowd-ranked tags, and legal streaming links |
| Episodes | Real episode titles and artwork where AniList has them, card or list |
| Characters | Every credited role, each card turning over to its voice actor |
| Staff | Director, composer, character designer, credited by job |
| Reception | Score histogram, watch-status split, rankings, four headline figures |
| Related | Prequels, sequels, side stories and the manga it came from |

**Search** is Cmd/Ctrl-K from anywhere, debounced, with the highlighted result
tinting the panel around it. `/browse` holds the same search in the URL with
genre include/exclude, format, status, season, year and score filters.

**Schedule** groups the coming week's broadcasts into *your* days, in *your*
clock, counting down live.

**The player** does what a player should: HLS with quality selection, sub/dub
switching mid-episode without losing your place, subtitles with three sizes,
playback speed, picture-in-picture, chapter-aware skip-intro, buffered-range
display on the scrub bar, resume-from-where-you-stopped, autoplay-next with a
countdown you can cancel, double-tap-to-seek on touch, and a full keyboard map
behind `?`.

**Library** keeps what you started, what you saved and what you finished,
locally, with a `SyncAdapter` interface ready for a backend.

---

## Design

**Chroma.** AniList returns a dominant colour for every title's artwork
(`coverImage.color`), which the old build fetched and threw away. It now drives
the interface: focus rings, hero washes, progress bars, card glows and the
score histogram all adopt the colour of whatever is on screen.
`lib/chroma.ts` lifts colours that are too dark to read against the background,
preserving hue, so the ring stays legible on a title whose key art is nearly
black.

The one place colour is *not* derived from artwork is the watch-status
breakdown, where five categories need five stable identities. Those come from a
fixed categorical palette, validated for colour-vision deficiency against the
panel background — colour follows the entity, never its size, so a title most
people dropped is never painted in the colour "Completed" wears elsewhere.

**Type.** Zen Kaku Gothic New for display, Inter for UI. The Japanese gothic is
a functional choice as much as a tonal one — the interface shows native titles
beside romaji, and a Latin-only display face falls apart the moment it hits
kana.

**Base palette.** Aubergine-black (`#0E0B16`) through to a violet-cast off-white
(`#F2EDF7`), with `#FF4D6D` reserved strictly for airing status. Everything else
is left grey so chroma is the only colour event on the page.

---

## Multi-device

One attribute on `<html>` drives the whole layout:

```
[data-device='mobile']   bottom tab bar   0.94× type   16px gutters
[data-device='desktop']  left icon rail   1.00× type   32px gutters
[data-device='tv']       wide rail        1.35× type   64px gutters, 4px focus
```

`hooks/useDevice.ts` sets it from viewport, pointer type and user agent. A
native wrapper can override it by setting `window.__ANIMUX_DEVICE__` before the
app boots.

Type sizes, gutters and nav width are all `calc()` against `--density`, so the
same components serve all three without a parallel TV stylesheet.

**Ready for the app port:** bottom tabs match the Android pattern, safe-area
insets are respected on every fixed surface, `manifest.webmanifest` and its
icons are wired for install-to-homescreen, the viewport is locked so a
double-tap seeks instead of zooming, and all search state lives in the URL so a
native shell can deep link into any filtered view.

---

## Talking to AniList without getting banned

AniList is a free API. It documents 90 requests a minute, has been running
capped at 30, and has a separate burst limiter on top; going over earns a
timeout, and doing it repeatedly from one IP earns a 403 block. Three things
keep Animux under that ceiling:

- **One gate.** Every outbound call passes the token bucket in
  `lib/catalogue/limiter.ts`. Requests queue rather than burst, and a
  `Retry-After` — or a 403 — puts the whole process into a cooldown.
- **One request per page.** The home page asks for its six shelves in a single
  aliased query instead of six round trips.
- **Nothing from the browser.** Client components go through `/api/catalogue`,
  so a viewer typing in the search box spends *our* shared, cached budget
  rather than their own IP's.

When upstream does refuse, a shelf that has ever loaded never goes blank:
successful responses are kept for a week and served stale behind a notice
saying how old they are. `/api/catalogue/health` answers the only question that
matters during an outage — is AniList down for everyone, or is this deployment's
IP blocked? Those have completely different fixes.

`ANILIST_ENDPOINT` overrides the endpoint, for a mirror or a fixture server.

---

## Streaming sources

`app/api/stream/route.ts` resolves an episode through the first source that is
configured.

**1. Your own backend.** Point `STREAM_PROVIDER_URL` at something you are
licensed to serve from and return:

```jsonc
{
  "sources": [
    { "id": "ja", "label": "Japanese", "url": "…m3u8",
      "type": "hls", "audioLang": "ja", "kind": "sub" },
    { "id": "en", "label": "English",  "url": "…m3u8",
      "type": "hls", "audioLang": "en", "kind": "dub" }
  ],
  "subtitles": [{ "lang": "en", "label": "English", "url": "…vtt" }],
  "chapters": { "intro": [12, 102] },
  "duration": 1420
}
```

One `sources` entry per audio track and the language picker populates itself.

If a source is a direct playlist URL on a host that checks `Referer` or serves
no CORS headers — which is most of them — add `referer` to it (or `proxy: true`
on its own) and Animux routes it through the signed proxy:

```jsonc
{ "id": "ja", "label": "Japanese", "url": "https://cdn.example/master.m3u8",
  "type": "hls", "audioLang": "ja", "kind": "sub",
  "referer": "https://player.example/" }
```

That matters more than it looks. Piping a playlist through a proxy unchanged
appears to work — the manifest loads — and then playback stops a few seconds
in, because the segment URIs inside it still point at the origin and the
browser fetches those without the header. The proxy rewrites every URI in the
manifest (variants, segments, `#EXT-X-KEY`, `#EXT-X-MAP`) to come back through
itself, which is the part that makes it actually play.

**2. Consumet / Aniwatch.** Set `CONSUMET_API_URL` and/or `ANIWATCH_API_URL`
at your own deployments of those projects and `lib/providers/` maps them onto
the same shape — Consumet first, per provider, then Aniwatch. Consumet's
`/meta/anilist/` routes are used so episodes resolve from the AniList id
directly rather than by fuzzy title match, and they also supply per-episode
artwork, which is better than AniList's own patchy `streamingEpisodes`.

Streams from these providers only play through `/api/stream/proxy`: their CDNs
reject requests without a `Referer`, which a browser cannot set on HLS segment
requests. The proxy attaches it, rewrites every URI in the playlist to come
back through itself, and refuses any URL it did not sign — set
`STREAM_PROXY_SECRET` to 32+ random characters.

Be clear-eyed about what this option is: both projects scrape sites that hold
no licence to the content. Neither is hosted for you, and neither runs unless
you set its variable.

**2b. AniHeist.** [`ZenHamza/AniHeist-api`](https://github.com/ZenHamza/AniHeist-api),
a separate Python service, tried ahead of everything else. The reason for the
ordering is not politeness: it is the only source here handed the AniList id
itself. Every other one has to search a catalogue by title and score the
results, and that step is both slow and the one that quietly returns season
one when you asked for season three. This path does not have it.

Set `ANIHEIST_API_URL` to your own deployment (the repo ships a Dockerfile and
a compose file); it otherwise uses the public instance, and `ANIHEIST_ENABLED=0`
turns it off. `/api/stream/health` reports whether it is answering.

Servers are selectable in the player under **Playback → Server** — Auto, Pewe,
Ally, Moo — and the choice persists across episodes. Two details matter:

- Every request pins `source=miruro`. Left to itself the API prefers a backend
  that answers with `format: "embed"`, which is a player *page* for an iframe,
  not a video URL; handing that to hls.js gets a manifest error or a spinner
  that never resolves. Any embed that does come back is refused with that
  reason rather than passed on as if playable.
- Picking a server explicitly means that server only. If Pewe fails, the
  request fails and says Pewe failed, rather than quietly serving Ally under
  Pewe's name. Only **Auto** sweeps the list. Pewe resolves through anidb.app
  and its own documentation marks it intermittent, which is exactly why it is
  worth being able to name it.

**3. In-process scraping.** The `aniwatch` package scrapes HiAnime from inside
this app's own API routes, so there is nothing separate to deploy. On by
default; `HIANIME_ENABLED=0` opts out. It runs on the server, not in the
browser — the catalogue serves no CORS headers and its segments are
Referer-locked, so anything claiming this works client-side describes
something that loads a manifest and then stalls. Streams still go out through
the signed proxy, which is what attaches the header and rewrites the manifest.

If it reports that HiAnime "did not answer", that is a network-level failure
from wherever the app is deployed, not a matching problem — the package's
client gives up after eight seconds and reports a bare "Something went wrong",
because a connect timeout carries no HTTP status to report instead. The mirror
it uses is `ANIWATCH_DOMAIN` (default `aniwatchtv.to`); point that at one your
host can reach, or set `HIANIME_ENABLED=0` and let the providers behind it
take the request. It is read once at startup, so changing it needs a redeploy.

Like option 2, this scrapes a site holding no licence to what it serves.

**4. Nothing available.** The player shows a setup screen naming what is missing, with a
live check of what the deployment can actually reach. It deliberately does not
play anything: an earlier version served a public test clip here, which meant
every episode of every title played the same stock cartoon — indistinguishable
from the app being broken, and the viewer only found out after sitting through
something they had not chosen. Set `STREAM_DEMO=1` to get that clip back while
working on the player itself.

Caption files are always proxied through `/api/stream/captions` rather than
linked directly. A `<track>` element is subject to CORS and provider CDNs
routinely lack the headers; the failure mode is the worst kind — no error,
just subtitles that never appear. Provider captions are signed the same way as
streams; hand-configured ones use the `STREAM_SUBTITLE_HOSTS` allowlist.

---

## Structure

```
app/
  page.tsx              home: hero carousel, continue watching, shelves
  browse/               advanced search, state held in the URL
  schedule/             the week's broadcasts, in local days
  title/[id]/           tabbed detail: overview, episodes, cast, stats, related
  watch/[id]/           full-screen player
  library/ settings/    local library and playback defaults
  api/catalogue/        proxy, cache and health check for AniList
  api/stream/           source contract, episode metadata, caption and HLS proxy
components/
  shell/AppShell        device-shaped navigation and top bar
  search/               command palette, filter bar
  home/                 hero carousel, airing strip
  media/                posters, rails, episodes, resume cards
  title/                every section of the detail page
  player/               player, menus, autoplay, shortcuts
  schedule/             the weekly board
hooks/                  useDevice, useChroma, useSpatialNav
lib/chroma.ts           artwork colour extraction and legibility
lib/catalogue/          rate limiter and stale-while-revalidate cache
lib/providers/          Consumet, Aniwatch and in-process HiAnime adapters
lib/providers/matching  AniList-title to scraper-title matching, shared
lib/stream/signing.ts   HMAC signing for proxied stream URLs
services/anilist.ts     every query the app makes
store/useLibrary.ts     progress, saved titles, preferences
```

## Still to build

- Sign-in and cross-device sync — `store/useLibrary.ts` takes a `SyncAdapter`
  with `pull()` and `push()`; wire your backend to that interface.
- Outro chapters are read from the provider contract but only intros are
  auto-skipped; the outro currently just brings the next-episode card forward.
