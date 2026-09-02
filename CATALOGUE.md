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

## Prisma

The app builds and deploys with **no database configured**. Prisma is only used
by one fallback branch in `app/api/stream/route.ts`; without `DATABASE_URL` that
branch returns 404 instead of throwing.

What was wrong before, all at once:

- `prisma/schema.prisma` used Prisma 7 syntax (`provider = "prisma-client"`, a
  `datasource` with no `url`) while `package.json` pins Prisma 5, so
  `prisma generate` could not succeed against it.
- The schema declared no models, yet the stream route queries `prisma.episode`.
- `lib/prisma.ts` constructed `new PrismaClient()` at module scope. Next's
  "Collecting page data" pass imports every route, so the *build* crashed with
  "@prisma/client did not initialize yet".
- `lib/prisma.ts` also imported types from `@prisma/client`, which exports
  nothing until generated — a second build failure behind the first.

Now: the schema targets Prisma 5 and defines `Episode`; `lib/prisma.ts`
constructs the client lazily on first property access and declares the record
shape locally instead of importing it.

To actually use a database:

```
DATABASE_URL=postgresql://...   # set this first
npm run db:generate             # generate the client
npm run db:push                 # create the Episode table
```

`prisma generate` is deliberately **not** part of `npm run build`. Adding it
reintroduces a build-time dependency on Prisma's binary downloads and on
`DATABASE_URL` being present, which is what made the build fragile before.

## Known stray files

`MediaGrid.tsx` (repo root) and `pp/explore/page.tsx` (a mistyped `app/`) look
like leftovers worth checking.

`.next/` is committed to the repo. Vercel warns about this, and a stale cached
build can shadow a real one. It is now in `.gitignore`, but git keeps tracking
files it already knows about, so run once:

```
git rm -r --cached .next
git commit -m "Stop tracking build output"
```


## Files that must be deleted, not overwritten

Extracting a zip over a repo adds and overwrites files, but it cannot remove
ones that are no longer wanted. These are stale and should be deleted from git:

```
git rm -f --ignore-unmatch prisma7.config.ts services/anilist.ts.bak
git rm -r --cached --ignore-unmatch .next
git commit -m "Remove stale generated files from the repo"
```

`prisma7.config.ts` is the one that matters: it imports `prisma/config`, a
Prisma 7 API that does not exist in the pinned Prisma 5, and `tsconfig.json`
picks up every `.ts` file in the tree. The build is defended against it by an
entry in `tsconfig.json`'s `exclude` list, so it will not break the build if it
stays — but there is no reason to keep it.
