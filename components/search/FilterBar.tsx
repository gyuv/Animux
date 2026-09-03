'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition, useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { GENRES, FORMATS, SORTS, STATUSES } from '@/services/anilist';

/**
 * Search state lives in the URL. That makes a set of filters shareable, gives
 * the back button something sensible to do, and means a native shell can deep
 * link straight into a filtered view.
 *
 * The previous build put its filters in hover-only dropdowns, which meant they
 * could not be opened by touch or by a remote at all. These are toggles in a
 * panel: one tap, one D-pad press, and the state is visible without hovering.
 */

const YEARS = Array.from({ length: 26 }, (_, i) => new Date().getFullYear() - i);
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const;

export function FilterBar({ total }: { total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const first = useRef(true);

  const genres = params.getAll('genre');
  const exclude = params.getAll('not');
  const formats = params.getAll('format');
  const activeCount = genres.length + exclude.length + formats.length +
    (params.get('status') ? 1 : 0) + (params.get('year') ? 1 : 0) +
    (params.get('season') ? 1 : 0) + (params.get('minScore') ? 1 : 0) +
    (params.get('tag') ? 1 : 0);

  const commit = (next: URLSearchParams) => {
    next.delete('page');
    startTransition(() => router.replace(`/browse?${next.toString()}`, { scroll: false }));
  };

  const setOne = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    value ? next.set(key, value) : next.delete(key);
    commit(next);
  };

  const toggleMany = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    const current = next.getAll(key);
    next.delete(key);
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updated.forEach((v) => next.append(key, v));
    commit(next);
  };

  // Debounce typing so a search fires once the viewer stops, not per keystroke.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      query.trim() ? next.set('q', query.trim()) : next.delete('q');
      commit(next);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const clearAll = () => {
    setQuery('');
    startTransition(() => router.replace('/browse', { scroll: false }));
  };

  return (
    <div className="gutter-x sticky top-topbar z-20 border-b border-ink-700/60 bg-ink-900/85 py-4 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-key border
                          border-ink-700 bg-ink-800 px-3.5 py-2.5 focus-within:border-chroma">
          <Search size={17} className="shrink-0 text-haze" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, in English or Japanese"
            aria-label="Search the catalogue"
            className="w-full bg-transparent text-body text-paper outline-none placeholder:text-haze/60"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={15} className="text-haze hover:text-paper" aria-hidden />
            </button>
          )}
        </label>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`key-ghost ${activeCount ? 'border-chroma text-chroma' : ''}`}
        >
          <SlidersHorizontal size={16} aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full
                             bg-chroma px-1.5 text-micro font-bold text-ink-900">
              {activeCount}
            </span>
          )}
        </button>

        <select
          value={params.get('sort') ?? 'POPULARITY_DESC'}
          onChange={(e) => setOne('sort', e.target.value)}
          aria-label="Sort results"
          className="key-ghost cursor-pointer appearance-none pr-8"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value} className="bg-ink-800">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {!open && activeCount > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {[
            ...genres.map((v) => ['genre', v, v] as const),
            ...exclude.map((v) => ['not', v, `− ${v}`] as const),
            ...formats.map((v) => ['format', v, v] as const),
            ...(params.get('status') ? [['status', params.get('status')!, params.get('status')!] as const] : []),
            ...(params.get('season') ? [['season', params.get('season')!, params.get('season')!] as const] : []),
            ...(params.get('year') ? [['year', params.get('year')!, params.get('year')!] as const] : []),
          ].map(([key, value, label]) => (
            <li key={`${key}:${value}`}>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params.toString());
                  const rest = next.getAll(key).filter((v) => v !== value);
                  next.delete(key);
                  rest.forEach((v) => next.append(key, v));
                  commit(next);
                }}
                className="chip capitalize"
                data-on="true"
              >
                {String(label).toLowerCase()}
                <X size={12} aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={clearAll} className="text-micro text-haze hover:text-paper">
              Clear all
            </button>
          </li>
        </ul>
      )}

      {open && (
        <div className="mt-4 space-y-5 rounded-panel border border-ink-700 bg-ink-800/60 p-5">
          <Group label="Genre" hint="Tap once to include, twice to exclude">
            {GENRES.map((g) => {
              const state = genres.includes(g) ? 'in' : exclude.includes(g) ? 'out' : 'off';
              return (
                <Chip
                  key={g}
                  state={state}
                  onClick={() => {
                    const next = new URLSearchParams(params.toString());
                    const inc = next.getAll('genre').filter((v) => v !== g);
                    const exc = next.getAll('not').filter((v) => v !== g);
                    next.delete('genre');
                    next.delete('not');
                    if (state === 'off') inc.push(g);
                    if (state === 'in') exc.push(g);
                    inc.forEach((v) => next.append('genre', v));
                    exc.forEach((v) => next.append('not', v));
                    commit(next);
                  }}
                >
                  {state === 'out' && <span className="mr-1" aria-hidden>−</span>}
                  {g}
                </Chip>
              );
            })}
          </Group>

          <Group label="Type">
            {FORMATS.map((f) => (
              <Chip
                key={f.value}
                state={formats.includes(f.value) ? 'in' : 'off'}
                onClick={() => toggleMany('format', f.value)}
              >
                {f.label}
              </Chip>
            ))}
          </Group>

          <Group label="Status">
            {STATUSES.map((s) => (
              <Chip
                key={s.value}
                state={params.get('status') === s.value ? 'in' : 'off'}
                onClick={() => setOne('status', params.get('status') === s.value ? null : s.value)}
              >
                {s.label}
              </Chip>
            ))}
          </Group>

          <Group label="Season">
            {SEASONS.map((s) => (
              <Chip
                key={s}
                state={params.get('season') === s ? 'in' : 'off'}
                onClick={() => setOne('season', params.get('season') === s ? null : s)}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Chip>
            ))}
          </Group>

          <Group label="Minimum score" hint="Out of 100, as AniList scores it">
            {[0, 60, 70, 75, 80, 85].map((score) => (
              <Chip
                key={score}
                state={(Number(params.get('minScore') ?? 0)) === score ? 'in' : 'off'}
                onClick={() => setOne('minScore', score ? String(score) : null)}
              >
                {score === 0 ? 'Any' : `${score}+`}
              </Chip>
            ))}
          </Group>

          <Group label="Year">
            <select
              value={params.get('year') ?? ''}
              onChange={(e) => setOne('year', e.target.value || null)}
              aria-label="Release year"
              className="rounded-key border border-ink-700 bg-ink-900 px-3 py-2 text-meta text-paper"
            >
              <option value="">Any year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </Group>

          <div className="flex items-center justify-between border-t border-ink-700 pt-4">
            <p className="text-meta text-haze" aria-live="polite">
              {pending ? 'Searching' : `${total.toLocaleString()} titles match`}
            </p>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="text-meta text-haze hover:text-paper">
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2.5">
        <h3 className="text-meta font-semibold text-paper">{label}</h3>
        {hint && <p className="text-micro text-haze/70">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
  state,
  onClick,
  children,
}: {
  state: 'in' | 'out' | 'off';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const styles =
    state === 'in'
      ? 'border-chroma bg-chroma/15 text-chroma'
      : state === 'out'
        ? 'border-signal/50 bg-signal/10 text-signal line-through'
        : 'border-ink-700 bg-ink-900 text-haze hover:border-ink-600 hover:text-paper';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={state !== 'off'}
      className={`rounded-full border px-3.5 py-1.5 text-meta transition-colors duration-150 ${styles}`}
    >
      {children}
    </button>
  );
}
