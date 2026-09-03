'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, CornerDownLeft, Loader2, X, Sparkles } from 'lucide-react';
import type { Anime } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { formatLabel, statusLabel } from '@/lib/format';

/**
 * Search that opens over whatever you were doing and closes without leaving a
 * trace — Cmd/Ctrl-K, or the search field in the top bar.
 *
 * Two details make it feel instant rather than merely fast: results are
 * requested 220 ms after the last keystroke (not on every one, which would
 * spend the catalogue's whole rate limit on someone typing "frieren"), and the
 * highlighted row publishes its artwork colour to the panel, so moving down
 * the list repaints the surround rather than the row.
 */

const DEBOUNCE_MS = 220;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  /* Reset every time it opens: a stale query from an hour ago is never what
     the viewer meant by pressing Cmd-K. */
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setError(null);
    setCursor(0);
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  /* Lock the page behind the overlay. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/catalogue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ search: term, perPage: 8 }),
          signal: controller.signal,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Search is unavailable.');
        setResults(body.media ?? []);
        setError(null);
        setCursor(0);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  const go = useCallback(
    (href: string) => { onClose(); router.push(href); },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[cursor];
      if (pick) go(`/title/${pick.id}`);
      else if (query.trim()) go(`/browse?q=${encodeURIComponent(query.trim())}`);
    }
  };

  /* Keep the highlighted row in view when arrowing past the fold. */
  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const active = results[cursor];
  const chroma = toChromaVar(active?.coverImage.color);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] animate-fade"
      role="dialog"
      aria-modal="true"
      aria-label="Search the catalogue"
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/80 backdrop-blur-sm"
      />

      <div
        style={{ ['--chroma' as string]: chroma }}
        className="glass relative w-full max-w-[640px] overflow-hidden rounded-panel animate-scale-in"
      >
        {/* The highlighted title's colour bleeds into the top of the panel. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 transition-opacity duration-500"
          style={{ background: `linear-gradient(180deg, rgb(${chroma} / 0.18), transparent)` }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search size={18} className="shrink-0 text-haze" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search anime, or press Enter to browse…"
            aria-label="Search"
            className="w-full bg-transparent py-4 text-lead text-paper outline-none placeholder:text-haze/60"
          />
          {loading && <Loader2 size={16} className="shrink-0 animate-spin text-haze" aria-hidden />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-key p-1.5 text-haze transition-colors hover:bg-white/5 hover:text-paper"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="relative max-h-[52vh] overflow-y-auto">
          {error && <p className="px-5 py-6 text-meta text-signal">{error}</p>}

          {!error && query.trim().length < 2 && (
            <div className="px-5 py-8">
              <p className="flex items-center gap-2 text-meta text-haze">
                <Sparkles size={14} aria-hidden />
                Type at least two characters.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Frieren', 'Cyberpunk', 'Mushishi', 'Ping Pong', 'Monogatari'].map((s) => (
                  <button key={s} type="button" onClick={() => setQuery(s)} className="chip">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
            <p className="px-5 py-8 text-meta text-haze">Nothing matched “{query.trim()}”.</p>
          )}

          <ul ref={listRef} role="listbox" aria-label="Results">
            {results.map((anime, i) => (
              <li key={anime.id} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(`/title/${anime.id}`)}
                  className={`flex w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors
                              ${i === cursor ? 'bg-white/[0.06]' : ''}`}
                >
                  <span className="relative h-[58px] w-[40px] shrink-0 overflow-hidden rounded bg-ink-700">
                    {anime.coverImage.large && (
                      <Image src={anime.coverImage.large} alt="" fill sizes="40px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-meta font-semibold text-paper">
                      {displayTitle(anime.title)}
                    </span>
                    <span className="mt-0.5 block truncate text-micro text-haze">
                      {[
                        formatLabel(anime.format),
                        anime.seasonYear,
                        statusLabel(anime.status),
                        anime.averageScore ? `${(anime.averageScore / 10).toFixed(1)}` : null,
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {i === cursor && (
                    <CornerDownLeft size={15} className="shrink-0 text-chroma" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <footer className="flex items-center gap-4 border-t border-white/[0.07] px-4 py-2.5 text-micro text-haze/70">
          <Hint keys="↑ ↓" label="navigate" />
          <Hint keys="⏎" label="open" />
          <Hint keys="esc" label="close" />
          {query.trim() && (
            <button
              type="button"
              onClick={() => go(`/browse?q=${encodeURIComponent(query.trim())}`)}
              className="ml-auto text-micro font-medium text-chroma hover:underline"
            >
              See all results
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-sans text-[10px] text-haze">
        {keys}
      </kbd>
      {label}
    </span>
  );
}
