# Catalogue notes

## When the site says AniList is unavailable

Open `/api/catalogue/health` on the affected deployment. It makes one live
request and reports back which of these you are actually looking at:

| What it says | What it means | What to do |
| --- | --- | --- |
| `AniList is answering normally` | Nothing is wrong upstream | Check the app logs |
| `AniList has disabled its public API` | Affects every app, not just Animux | Wait. The site keeps serving cached shelves meanwhile |
| `This server IP is blocked` | AniList blocked this specific IP for request volume | Waiting will not help. Redeploy behind a different IP and keep volume down |
| `Rate limited` | Too many requests, temporarily | Clears itself, usually within a minute |
| `Cannot reach AniList at all` | DNS, TLS, or egress problem on the host | Check the host's outbound network |

The first two both arrive as HTTP 403, which is why the site could not tell
them apart before — and they have completely different fixes.

## Request budget

AniList allows 90 requests/minute, but has been running degraded at 30. There
is a separate burst limiter on top. Everything the app sends passes through
`lib/catalogue/limiter.ts`, which holds the app at 24/minute with at most 4 in
flight, and stops sending entirely during a cooldown.

Do not add a call that bypasses it. In particular, do not fetch
`graphql.anilist.co` from a client component — that puts the request on the
viewer's connection where nothing can pace it, and it is what made the library
page issue up to forty simultaneous requests per visitor.

Server code calls `services/anilist.ts`. Browser code calls `/api/catalogue`
or `/api/catalogue/by-ids`.

## Behaviour during an outage

In order: fresh cache, live AniList, then stale cache (up to a week old). A
viewer only sees an error page when all three miss — which, after the first
successful load of a given shelf, means a cold process rather than an outage.
Stale results carry a `meta.notice` string, which the UI renders as a small
banner above the content rather than replacing it.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `ANILIST_USER_AGENT` | `Animux/3.0 (+https://animux.app; ...)` | Set this to a real contact address. Cloudflare sits in front of AniList and treats requests without a meaningful User-Agent as bot traffic |
| `ANILIST_RATE_PER_MIN` | `24` | Lower it if you get rate limited; do not raise it above 30 while the API is degraded |
| `ANILIST_BURST` | `4` | Maximum simultaneous requests |
| `ANILIST_ENDPOINT` | `https://graphql.anilist.co` | Point at a mirror, or at a fixture server when developing offline |
| `STREAM_PROVIDER_URL` | — | Your own licensed backend. Takes precedence over everything below |
| `STREAM_PROVIDER_KEY` | — | Bearer token for the above, if it needs one |
| `STREAM_SUBTITLE_HOSTS` | — | Comma-separated hosts the caption proxy may fetch from, beyond the provider's own |
| `CONSUMET_API_URL` | — | Your Consumet deployment. Enables the scraper path |
| `ANIWATCH_API_URL` | — | Your Aniwatch deployment. Fallback for the above |
| `STREAM_PROXY_SECRET` | random per process | **Set this.** 32+ random characters; signs proxy URLs |
| `STREAM_PROXY_USER_AGENT` | a desktop Chrome string | Sent upstream alongside the Referer |

## Caching

`lib/catalogue/cache.ts` holds successful responses in process memory with a
per-query TTL (30 minutes for the home shelves, 15 for a text search, 12 hours
for a title page) and keeps them usable as a fallback for a week past that.
Identical queries issued in the same tick share one upstream request, so the
six shelves on the home page and a burst of pagination clicks cost one call
between them.

It is deliberately in-process rather than shared. On a single long-lived server
that is the whole story; behind several serverless instances each keeps its own
copy, which is more upstream traffic than a shared cache but still bounded by
the limiter, and it needs no infrastructure. If you deploy widely enough for
that to matter, replace the `read`/`write` pair with your store of choice —
nothing else in the app touches it.

## No database

The app has none, and needs none. An earlier version carried a half-configured
Prisma setup whose client was constructed at module scope, which crashed the
build during Next's "Collecting page data" pass. It has been removed along with
the Supabase client that threw on load whenever its environment variables were
absent.

Watch progress, saved titles and playback preferences live in `localStorage`
via `store/useLibrary.ts`. To add a backend, implement its `SyncAdapter`
(`pull()` and `push()`) and hand it to `attachSync` — that is the only seam the
rest of the app knows about.

## Streaming providers

The player resolves an episode through the first of these that is configured:

1. **`STREAM_PROVIDER_URL`** — your own backend, returning the payload shape
   documented at the top of `app/api/stream/route.ts`. Nothing is rewritten
   except caption URLs, which are routed through the proxy for CORS.
2. **`CONSUMET_API_URL` / `ANIWATCH_API_URL`** — the scraper APIs, mapped onto
   that shape by `lib/providers/`.
3. **Neither** — public test streams, so the player stays exercisable.

### Why the adapters use `/meta/anilist/`

Consumet exposes both `/anime/gogoanime/info?id={slug}` and
`/meta/anilist/info/{anilistId}`. Only the second takes an AniList id. Using
the first would leave us matching an AniList id to a provider slug by fuzzy
title search, which is the single biggest cause of "it played the wrong show"
in every app built on these APIs. The meta routes also return per-episode
`image` and `title`, which is better episode artwork than AniList's own
`streamingEpisodes` field carries.

Aniwatch has no AniList mapping at all, so `lib/providers/aniwatch.ts` has to
search by title. That matching is deliberately strict — exact match on a
normalised title, across every name AniList knows — because a page that says
"no source" is recoverable and silently playing a different series is not.

### The proxy is not optional

These providers resolve to CDNs that reject any request without the right
`Referer`, and a browser cannot set `Referer` on the segment requests hls.js
makes. So segments are fetched server-side by `/api/stream/proxy`, which also
settles CORS by being same-origin. Playlists are rewritten on the way through:
every variant, segment and `#EXT-X-KEY` URI is re-pointed at the proxy, because
the moment one segment URL goes direct the stream stalls a few seconds in.

That route is a fetch primitive aimed at arbitrary hosts, so it only fetches
URLs it signed itself — HMAC over the URL, Referer and an expiry, keyed by
`STREAM_PROXY_SECRET`. A host allowlist cannot work here: stream hosts rotate
per request and are unknown until the provider answers. Set the secret; the
per-process fallback breaks links across restarts and between instances.

### Legality

Consumet and Aniwatch scrape sites that hold no licence to the content they
serve. Neither is hosted for you, and neither is enabled unless you set its
variable. Option 1 above is the path without that problem.
