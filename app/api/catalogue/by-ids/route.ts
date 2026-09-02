import { NextResponse } from 'next/server';
import { getAnimeByIds } from '@/services/anilist';

/** Bulk title lookup for the library. One request, up to fifty titles. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let ids: unknown;

  try {
    ({ ids } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with an "ids" array.' }, { status: 400 });
  }

  if (!Array.isArray(ids)) {
    return NextResponse.json({ error: '"ids" must be an array of numbers.' }, { status: 400 });
  }

  const { media, meta } = await getAnimeByIds(ids.map(Number));

  return NextResponse.json(
    { media, notice: meta.notice },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400' } },
  );
}
