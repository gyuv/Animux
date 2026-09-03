import { notFound } from 'next/navigation';
import { getAnime, displayTitle, AniListError } from '@/services/anilist';
import { WatchScreen } from '@/components/player/WatchScreen';

export const revalidate = 43200;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { anime } = await getAnime(Number(id));
    return { title: `Watching ${displayTitle(anime.title)}` };
  } catch {
    return { title: 'Watch' };
  }
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ep?: string; t?: string }>;
}) {
  const [{ id: rawId }, query] = await Promise.all([params, searchParams]);
  const id = Number(rawId);
  if (!Number.isFinite(id)) notFound();

  let anime;
  try {
    ({ anime } = await getAnime(id));
  } catch (error) {
    if (error instanceof AniListError && error.kind === 'query') notFound();
    throw error;
  }

  if (!anime) notFound();

  const episode = Math.max(1, Number(query.ep ?? 1) || 1);
  const startAt = Math.max(0, Number(query.t ?? 0) || 0);

  return (
    <WatchScreen
      animeId={String(anime.id)}
      title={displayTitle(anime.title)}
      cover={anime.bannerImage || anime.coverImage.extraLarge || ''}
      color={anime.coverImage.color}
      episode={episode}
      totalEpisodes={anime.episodes}
      startAt={startAt}
    />
  );
}
