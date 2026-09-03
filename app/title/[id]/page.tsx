import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getAnime, displayTitle } from '@/services/anilist';
import { stripHtml, season, airingIn } from '@/lib/format';
import { toChromaVar } from '@/lib/chroma';
import { EpisodeList } from '@/components/media/EpisodeList';
import { SaveButton } from '@/components/media/SaveButton';
import { Rail } from '@/components/media/Rail';
import { PosterCard } from '@/components/media/PosterCard';
import { ChromaScope } from '@/components/ui/ChromaScope';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const anime = await getAnime(Number(id));
    return {
      title: displayTitle(anime.title),
      description: stripHtml(anime.description).slice(0, 160),
    };
  } catch {
    return { title: 'Title' };
  }
}

export default async function TitlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  let anime;
  try {
    anime = await getAnime(id);
  } catch {
    notFound();
  }

  const chroma = toChromaVar(anime.coverImage.color);
  const backdrop = anime.bannerImage || anime.coverImage.extraLarge;
  const synopsis = stripHtml(anime.description);
  const next = airingIn(anime.nextAiringEpisode?.timeUntilAiring);
  const recommendations = (anime.recommendations?.nodes ?? [])
    .map((n: any) => n.mediaRecommendation)
    .filter(Boolean);

  const facts = [
    ['Type', anime.format?.replace('_', ' ')],
    ['Episodes', anime.episodes ? String(anime.episodes) : null],
    ['Runtime', anime.duration ? `${anime.duration} min` : null],
    ['Released', season(anime.season, anime.seasonYear) || null],
    ['Studio', anime.studios?.nodes?.[0]?.name ?? null],
    ['Rating', anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)} out of 10` : null],
  ].filter(([, v]) => Boolean(v)) as [string, string][];

  return (
    <ChromaScope color={anime.coverImage.color}>
      <div style={{ ['--chroma' as string]: chroma }}>
        {/* Backdrop, held short so the artwork frames the page without owning it. */}
        <div className="relative h-[38svh] min-h-[240px] w-full sm:h-[46svh]">
          {backdrop && <Image src={backdrop} alt="" fill priority sizes="100vw" className="object-cover object-top" />}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/55 to-ink-900/20" />
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, rgb(${chroma} / 0.22), transparent 55%)` }}
          />
        </div>

        <div className="gutter-x -mt-24 sm:-mt-32">
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            <div className="relative aspect-[2/3] w-[132px] shrink-0 overflow-hidden rounded-art
                            bg-ink-800 shadow-2xl sm:w-[196px]">
              {anime.coverImage.extraLarge && (
                <Image src={anime.coverImage.extraLarge} alt="" fill sizes="196px" className="object-cover" />
              )}
            </div>

            <div className="min-w-0 flex-1 sm:pt-24">
              <h1 className="font-display text-hero font-black leading-none text-paper">
                {displayTitle(anime.title)}
              </h1>
              {anime.title.native && (
                <p className="mt-1.5 font-display text-lead font-bold text-haze/80">{anime.title.native}</p>
              )}

              {next && (
                <p className="mt-3 inline-flex items-center gap-2 text-meta font-medium text-signal">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse-signal" aria-hidden />
                  {next}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={`/watch/${anime.id}?ep=1`} className="key-primary">Play episode 1</Link>
                <SaveButton animeId={String(anime.id)} />
              </div>

              {anime.genres.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {anime.genres.map((g) => (
                    <li key={g}>
                      <Link
                        href={`/browse?genre=${encodeURIComponent(g)}`}
                        className="inline-block rounded-full border border-ink-700 bg-ink-800
                                   px-3 py-1 text-micro text-haze transition-colors
                                   hover:border-chroma hover:text-chroma"
                      >
                        {g}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {synopsis && (
            <p className="mt-8 max-w-[68ch] text-body text-haze">{synopsis}</p>
          )}

          <dl className="mt-8 grid gap-x-8 gap-y-4 border-t border-ink-700 pt-6
                         [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-micro text-haze/70">{k}</dt>
                <dd className="mt-0.5 text-meta font-medium text-paper">{v}</dd>
              </div>
            ))}
          </dl>

          <EpisodeList
            animeId={String(anime.id)}
            total={anime.episodes}
            airingNext={anime.nextAiringEpisode?.episode ?? null}
          />
        </div>

        {recommendations.length > 0 && (
          <Rail title="If you liked this">
            {recommendations.map((r: any) => (
              <PosterCard key={r.id} anime={r} />
            ))}
          </Rail>
        )}

        <div className="h-12" />
      </div>
    </ChromaScope>
  );
}
