import { NextResponse } from 'next/server';
import { titleLogo, tmdbConfigured } from '@/services/tmdb';

/**
 * The title-art logo for one AniList id, from TMDB.
 *
 * Fetched by the hero after mount rather than baked into the page, so a slow or
 * unconfigured TMDB never delays the first paint — the text title renders
 * immediately and the logo swaps in over it if and when one is found. Always
 * answers 200 with `{ logo: string | null }`; null is a normal answer (no key,
 * no mapping, no logo on file), not an error.
 *
 *   GET /api/logo?id=<anilistId>[&format=MOVIE]
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));

  if (!Number.isFinite(id) || !tmdbConfigured()) {
    return NextResponse.json({ logo: null }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const logo = await titleLogo(id, searchParams.get('format') === 'MOVIE');

  return NextResponse.json(
    { logo },
    // A day on the CDN when found; short when not, so setting the key later
    // does not leave every title stuck on "no logo".
    { headers: { 'Cache-Control': logo ? 'public, max-age=86400' : 'public, max-age=600' } },
  );
}
