# Animux

Anime streaming front end. Next.js 14 App Router, TypeScript, Tailwind.

---

## Why the old build looked broken

There was no `postcss.config.js`.

Without it Next.js never runs Tailwind, so `@tailwind base; @tailwind
components; @tailwind utilities;` shipped to the browser as literal text. The
compiled stylesheet in the old `.next` folder was **215 bytes** and still
contained those three lines unprocessed. Every utility class in the codebase —
every gradient, radius, grid and spacing value — did nothing. What rendered was
unstyled HTML on a dark background.

The stylesheet now compiles to about 27 KB of real CSS. That one file was the
whole of the "it looks bad" problem.

---

## Other bugs found and fixed

| Problem | Effect | Fix |
| --- | --- | --- |
| No `postcss.config.js` | Tailwind never ran | Added |
| `description` missing from the AniList query, but read in the UI | Hero synopsis was always `undefined` and fell back to placeholder copy | Field added to the query |
| `pp/explore/page.tsx` | Typo'd folder outside `app/`; dead route | Removed |
| `MediaGrid.tsx` at repo root | Outside Tailwind's `content` globs, so its classes never compiled even after Tailwind worked | Folded into `components/media/` |
| `app/page.tsx` and `app/explore/page.tsx` near-identical | Two homepages | One home, one browse |
| `animate-spin-slow` used in JSX | Never defined in the config; silently did nothing | Removed; real keyframes defined |
| Filters in hover-only dropdowns | Unopenable on touch and on a TV remote | Toggle chips in a panel |
| `useTVNavigation` jumped `±4` in a flat DOM list | Broke on any grid that was not four columns; focused offscreen elements | Geometric spatial navigation |
| Supabase client constructed at module scope with empty env strings | Threw on load when unconfigured | Local-first store, optional sync adapter |
| Progress saved on `Math.floor(t) % 5 === 0` | True for every `timeupdate` in that second — roughly 15 writes per save | Throttled to one write per 5 s wall clock |
| `isMuted` state never applied to the video element | Mute button did nothing | Bound via effect |
| No detail page, no watch route | Nothing ever wrote progress, so Continue Watching stayed empty | Both routes added |
| `target: es5` in tsconfig | Oversized, slower output | `ES2020` |
| `.next/` committed | 60+ build artifacts in the repo | Gitignored |

---

## Design

**Chroma.** AniList returns a dominant colour for every title's artwork
(`coverImage.color`), which the old build fetched and threw away. It now drives
the interface: focus rings, hero washes, progress bars and card glows all adopt
the colour of whatever is on screen. `lib/chroma.ts` lifts colours that are too
dark to read against the background, preserving hue, so the ring stays legible
on a title whose key art is nearly black.

**Type.** Zen Kaku Gothic New for display, Inter for UI. The Japanese gothic is
a functional choice as much as a tonal one — the interface shows native titles
beside romaji, and a Latin-only display face falls apart the moment it hits kana.

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
insets are respected on every fixed surface, `manifest.webmanifest` is wired for
install-to-homescreen, viewport is locked so a double-tap seeks instead of
zooming, and all search state lives in the URL so a native shell can deep link
into any filtered view.

---

## Streaming sources

`app/api/stream/route.ts` defines the contract but does **not** source video.
Point it at a backend you are licensed to serve from:

```
STREAM_PROVIDER_URL=https://your-backend.example/resolve
STREAM_PROVIDER_KEY=optional-bearer-token
```

Expected response:

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

Return one `sources` entry per audio track and the language picker populates
itself. With no provider set the route serves a public test stream, so the
player, language switching and resume logic are all exercisable in development.

---

## Running it

```bash
npm install
npm run dev
```

Metadata comes from AniList's public GraphQL API — no key needed.

## Structure

```
app/
  page.tsx              home: hero, continue watching, shelves
  browse/               advanced search, state held in the URL
  title/[id]/           details, facts, episode list
  watch/[id]/           full-screen player
  api/stream/           source contract
components/
  shell/AppShell        device-shaped navigation
  media/                posters, rails, hero, episodes
  player/               player, language menu
  search/FilterBar      filters
hooks/                  useDevice, useChroma, useSpatialNav
lib/chroma.ts           artwork colour extraction and legibility
services/anilist.ts     metadata
store/useLibrary.ts     progress, saved titles, preferences
```

## Still to build

- Sign-in and cross-device sync — `store/useLibrary.ts` takes a `SyncAdapter`
  with `pull()` and `push()`; wire your backend to that interface.
- `public/icon-192.png`, `icon-512.png`, `icon-mask.png` for the manifest.
- Autoplay-next on episode end (the preference is stored and read; the handler
  is not wired).
