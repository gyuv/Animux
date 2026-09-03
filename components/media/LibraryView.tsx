'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLibrary } from '@/store/useLibrary';
import { searchAnime, type Anime } from '@/services/anilist';
import { PosterCard, PosterSkeleton } from './PosterCard';
import { ContinueCard } from './ContinueCard';
import { EmptyState } from '@/components/ui/EmptyState';

export function LibraryView() {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);

  const savedIds = useLibrary((s) => s.saved);
  const progress = useLibrary((s) => s.progress);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || savedIds.length === 0) {
      setSaved([]);
      return;
    }
    setLoading(true);
    // AniList has no bulk-by-id helper in our search shape, so we resolve the
    // saved list one title at a time and keep whatever comes back.
    Promise.all(
      savedIds.slice(0, 40).map((id) =>
        fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query($id:Int){Media(id:$id,type:ANIME){id title{romaji english native} coverImage{extraLarge large color} averageScore status episodes}}`,
            variables: { id: Number(id) },
          }),
        })
          .then((r) => r.json())
          .then((j) => j?.data?.Media as Anime | undefined)
          .catch(() => undefined),
      ),
    )
      .then((rows) => setSaved(rows.filter(Boolean) as Anime[]))
      .finally(() => setLoading(false));
  }, [mounted, savedIds]);

  if (!mounted) return null;

  const inProgress = progress
    .filter((p) => {
      const r = p.duration > 0 ? p.position / p.duration : 0;
      return r > 0.02 && r < 0.92;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  if (inProgress.length === 0 && savedIds.length === 0) {
    return (
      <EmptyState
        title="Your library is empty"
        body="Anything you start watching or save will collect here, and it follows you between devices once you sign in."
        action={<Link href="/browse" className="key-primary">Find something to watch</Link>}
      />
    );
  }

  return (
    <div className="gutter-x py-8">
      <h1 className="font-display text-hero font-black text-paper">Library</h1>

      {inProgress.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3.5 font-display text-title font-bold text-paper">Still watching</h2>
          <div className="rail-scroll -mx-[var(--gutter)] px-[var(--gutter)]">
            {inProgress.map((e) => (
              <ContinueCard key={`${e.animeId}:${e.episode}`} entry={e} />
            ))}
          </div>
        </section>
      )}

      {savedIds.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3.5 font-display text-title font-bold text-paper">Saved</h2>
          <div className="grid gap-x-3 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(144px,1fr))]
                          sm:[grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]">
            {loading && saved.length === 0
              ? Array.from({ length: savedIds.length }).map((_, i) => <PosterSkeleton key={i} />)
              : saved.map((a) => (
                  <div key={a.id} className="w-full [&>a]:w-full">
                    <PosterCard anime={a} />
                  </div>
                ))}
          </div>
        </section>
      )}

      <div className="h-12" />
    </div>
  );
}
