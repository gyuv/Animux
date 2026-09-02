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

In order: fresh cache, live AniList, stale cache (up to a week old), then the
Jikan fallback. A viewer only sees an error page when all four fail. Stale and
fallback results carry a `meta.notice` string, which the UI shows as a small
banner above the content rather than replacing it.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `ANILIST_USER_AGENT` | `Animux/2.0 (+https://animux.app; ...)` | Set this to a real contact address. Cloudflare sits in front of AniList and treats requests without a meaningful User-Agent as bot traffic |
| `ANILIST_RATE_PER_MIN` | `24` | Lower it if you get rate limited; do not raise it above 30 while the API is degraded |
| `ANILIST_BURST` | `4` | Maximum simultaneous requests |

## Known stray files

`prisma7.config.ts` is a Prisma 7 generated config that imports `prisma/config`,
but `package.json` pins Prisma 5. It is not referenced by the app and it breaks
`next build`, so it is excluded in `tsconfig.json`. Delete it, or upgrade Prisma
and remove the exclusion.

`MediaGrid.tsx` (repo root) and `pp/explore/page.tsx` (a mistyped `app/`) also
look like leftovers worth checking.
