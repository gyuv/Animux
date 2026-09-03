import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAnime, displayTitle, AniListError } from '@/services/anilist';
import { stripHtml } from '@/lib/format';
import { TitleHero } from '@/components/title/TitleHero';
import { TitleTabs } from '@/components/title/TitleTabs';
import { Synopsis } from '@/components/title/Synopsis';
import { FactSheet } from '@/components/title/FactSheet';
import { TagCloud } from '@/components/title/TagCloud';
import { WhereToWatch } from '@/components/title/WhereToWatch';
import { CharacterGrid } from '@/components/title/CharacterGrid';
import { StaffGrid } from '@/components/title/StaffGrid';
import { Reception } from '@/components/title/Reception';
import { RelationRail } from '@/components/title/RelationRail';
import { EpisodeList } from '@/components/media/EpisodeList';
import { Rail } from '@/components/media/Rail';
import { PosterCard } from '@/components/media/PosterCard';
import { ChromaScope } from '@/components/ui/ChromaScope';
import { CatalogueNotice } from '@/components/ui/CatalogueNotice';
import { EmptyState } from '@/components/ui/EmptyState';

export const revalidate = 43200;

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const { anime } = await getAnime(Number(params.id));
    const description = stripHtml(anime.description).slice(0, 160);
    const image = anime.coverImage.extraLarge ?? undefined;

    return {
      title: displayTitle(anime.title),
      description,
      openGraph: {
        title: displayTitle(anime.title),
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: 'Title' };
  }
}

export default async function TitlePage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let anime;
  let notice: string | null = null;

  try {
    const result = await getAnime(id);
    anime = result.anime;
    notice = result.meta.notice;
  } catch (error) {
    if (error instanceof AniListError && error.kind === 'query') notFound();
    return (
      <EmptyState
        title="Could not load this title"
        body={
          error instanceof AniListError
            ? error.viewerMessage
            : 'Something went wrong reaching the catalogue.'
        }
        action={<Link href="/" className="key-primary">Back to home</Link>}
      />
    );
  }

  if (!anime) notFound();

  const synopsis = stripHtml(anime.description);
  const characters = anime.characters?.edges ?? [];
  const staff = anime.staff?.edges ?? [];
  const relations = (anime.relations?.edges ?? []).filter((e) => e.node);
  const recommendations = (anime.recommendations?.nodes ?? [])
    .map((n) => n.mediaRecommendation)
    .filter(Boolean);

  const episodeCount = anime.episodes ?? (anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : null);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'episodes', label: 'Episodes', count: episodeCount },
    { id: 'characters', label: 'Characters', count: characters.length || null },
    { id: 'staff', label: 'Staff', count: staff.length || null },
    { id: 'reception', label: 'Reception' },
    { id: 'related', label: 'Related', count: relations.length || null },
  ];

  return (
    <ChromaScope color={anime.coverImage.color}>
      {notice && <CatalogueNotice message={notice} />}

      <TitleHero anime={anime} />

      <div className="gutter-x">
        <TitleTabs tabs={tabs}>
          {/* Overview */}
          <div className="space-y-10 pb-4">
            <Synopsis text={synopsis} />
            <FactSheet anime={anime} />
            <TagCloud tags={anime.tags ?? []} />
            <WhereToWatch links={anime.externalLinks ?? []} />
          </div>

          {/* Episodes */}
          <div className="pb-4">
            <EpisodeList
              animeId={String(anime.id)}
              total={anime.episodes}
              airingNext={anime.nextAiringEpisode?.episode ?? null}
              streamingEpisodes={anime.streamingEpisodes ?? []}
            />
          </div>

          {/* Characters */}
          <div className="pb-4">
            <CharacterGrid edges={characters} />
          </div>

          {/* Staff */}
          <div className="pb-4">
            <StaffGrid edges={staff} />
          </div>

          {/* Reception */}
          <div className="pb-4">
            <Reception
              stats={anime.stats}
              rankings={anime.rankings ?? []}
              averageScore={anime.averageScore}
              meanScore={anime.meanScore}
              popularity={anime.popularity}
              favourites={anime.favourites}
            />
          </div>

          {/* Related */}
          <div className="pb-4">
            <RelationRail edges={relations} />
          </div>
        </TitleTabs>
      </div>

      {recommendations.length > 0 && (
        <Rail title="If you liked this" note="What other viewers went to next">
          {recommendations.map((r) => (
            <PosterCard key={r!.id} anime={r!} />
          ))}
        </Rail>
      )}

      <div className="h-12" />
    </ChromaScope>
  );
}
