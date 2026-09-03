'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLibrary } from '@/store/useLibrary';
import type { Anime } from '@/services/anilist';
import { PosterCard, PosterSkeleton } from './PosterCard';
import { ContinueCard } from './ContinueCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CatalogueNotice } from '@/components/ui/CatalogueNotice';

/**
 * Everything the viewer has started or saved.
 *
 * The saved list is resolved through `/api/catalogue/by-ids` — one request for
 * up to fifty titles. The previous version fired one browser request per saved
 * title straight at graphql.anilist.co, which meant a viewer with thirty saved
 * shows opened this page and immediately spent AniList's entire per-minute
 * budget from their own IP.
 */

type Tab = 'watching' | 'saved' | 'finished';

export function LibraryView() {
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('watching');

  const savedIds = useLibrary((s) => s.saved);
  const progress = useLibrary((s) => s.progress);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || savedIds.length === 0) {
      setSaved([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch('/api/catalogue/by-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: savedIds.slice(0, 50).map(Number) }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((body) => {
        setSaved(body.media ?? []);
        setNotice(body.notice ?? null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setNotice('Could not load your saved titles.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [mounted, savedIds]);

  const { watching, finished } = useMemo(() => {
    const started: typeof progress = [];
    const done: typeof progress = [];
    for (const p of progress) {
      const ratio = p.duration > 0 ? p.position / p.duration : 0;
      if (ratio >= 0.92) done.push(p);
      else if (ratio > 0.02) started.push(p);
    }
    const recent = (a: { updatedAt: number }, b: { updatedAt: number }) => b.updatedAt - a.updatedAt;
    return { watching: started.sort(recent), finished: done.sort(recent) };
  }, [progress]);

  if (!mounted) {
    return (
      <div className="gutter-x pt-topbar" aria-busy="true">
        <div className="skeleton mt-8 h-10 w-40 rounded" />
        <div className="mt-8 grid gap-x-3 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(144px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => <PosterSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (watching.length === 0 && savedIds.length === 0 && finished.length === 0) {
    return (
      <div className="pt-topbar">
        <EmptyState
          title="Your library is empty"
          body="Anything you start watching or save collects here, and it follows you between devices once sync is wired up."
          action={<Link href="/browse" className="key-primary">Find something to watch</Link>}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'watching', label: 'Still watching', count: watching.length },
    { id: 'saved', label: 'Saved', count: savedIds.length },
    { id: 'finished', label: 'Finished', count: finished.length },
  ];

  return (
    <div className="pt-topbar">
      {notice && <CatalogueNotice message={notice} />}

      <div className="gutter-x py-8">
        <h1 className="font-display text-hero font-black text-paper">Library</h1>

        <div role="tablist" aria-label="Library sections" className="mt-6 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              data-on={tab === t.id}
              className="chip px-4 py-2 text-meta"
            >
              {t.label}
              <span className="tabular-nums opacity-70">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === 'watching' && (
            watching.length === 0 ? (
              <Blank>Nothing part-watched right now.</Blank>
            ) : (
              <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
                {watching.map((entry) => (
                  <li key={`${entry.animeId}:${entry.episode}`}>
                    <ContinueCard entry={entry} fill />
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === 'saved' && (
            savedIds.length === 0 ? (
              <Blank>Nothing saved yet.</Blank>
            ) : (
              <div className="grid gap-x-3 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(144px,1fr))]
                              sm:[grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]">
                {loading && saved.length === 0
                  ? Array.from({ length: Math.min(savedIds.length, 12) }).map((_, i) => <PosterSkeleton key={i} />)
                  : saved.map((a) => (
                      <div key={a.id} className="w-full [&>a]:w-full">
                        <PosterCard anime={a} />
                      </div>
                    ))}
              </div>
            )
          )}

          {tab === 'finished' && (
            finished.length === 0 ? (
              <Blank>Nothing finished on this device yet.</Blank>
            ) : (
              <ul className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
                {finished.map((entry) => (
                  <li key={`${entry.animeId}:${entry.episode}`}>
                    <ContinueCard entry={entry} fill />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}

function Blank({ children }: { children: React.ReactNode }) {
  return <p className="text-meta text-haze">{children}</p>;
}
