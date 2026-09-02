import { notFound } from 'next/navigation';
import { getAnime, displayTitle } from '@/services/anilist';
import { WatchScreen } from '@/components/player/WatchScreen';

export const revalidate = 86400;

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const anime = await getAnime(Number(params.id));
    return { title: `Watching ${displayTitle(anime.title)}` };
  } catch {
    return { title: 'Watch' };
  }
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ep?: string; t?: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  let anime;
  try {
    anime = await getAnime(id);
  } catch {
    notFound();
  }

  const episode = Math.max(1, Number(searchParams.ep ?? 1));
  const startAt = Math.max(0, Number(searchParams.t ?? 0));

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
