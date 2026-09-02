'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLibrary } from '@/store/useLibrary';
import type { Anime } from '@/services/anilist';
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
    const controller = new AbortController();

    /**
     * One request for the whole saved list. This previously issued a separate
     * call to AniList for every saved title — forty browsers' worth of that is
     * exactly the traffic pattern that gets an app rate limited and then
     * blocked, and it was doing it from the viewer's own connection.
     */
    fetch('/api/catalogue/by-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: savedIds.map(Number) }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((json) => setSaved((json?.media ?? []) as Anime[]))
      .catch(() => {
        // Keep whatever is already on screen rather than emptying the shelf.
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
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
