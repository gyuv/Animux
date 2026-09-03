'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import type { AiringEntry } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { airTime, countdown } from '@/lib/format';

/**
 * The week, grouped into the viewer's own days.
 *
 * Grouping has to happen in the browser: "Tuesday" is a property of the
 * viewer's time zone, not the server's, and a schedule rendered against UTC
 * puts half of Japan's Monday night into Sunday for anyone west of London.
 * Until the client has mounted, the board renders the flat list — correct
 * everywhere, just not yet grouped.
 */
export function ScheduleBoard({ entries }: { entries: AiringEntry[] }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(timer);
  }, []);

  const days = useMemo(() => {
    const map = new Map<string, { key: string; label: string; entries: AiringEntry[] }>();

    for (const entry of entries) {
      const date = new Date(entry.airingAt * 1000);
      const key = date.toDateString();
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
          entries: [],
        });
      }
      map.get(key)!.entries.push(entry);
    }

    return [...map.values()].sort(
      (a, b) => (a.entries[0]?.airingAt ?? 0) - (b.entries[0]?.airingAt ?? 0),
    );
  }, [entries]);

  const today = mounted ? new Date().toDateString() : null;
  const active = day ?? today ?? days[0]?.key ?? null;
  const shown = days.find((d) => d.key === active) ?? days[0];

  if (!mounted) {
    return (
      <div className="gutter-x py-8" aria-hidden>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {entries.slice(0, 12).map((e) => (
            <div key={e.id} className="skeleton h-[86px] rounded-panel" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <nav aria-label="Days" className="rail-scroll gutter-x mb-6 pb-1">
        {days.map((d) => {
          const on = d.key === active;
          const isToday = d.key === today;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setDay(d.key)}
              aria-current={on ? 'true' : undefined}
              className={`flex shrink-0 flex-col items-start gap-0.5 rounded-panel border px-4 py-3
                          transition-all duration-200 ease-physical
                          ${on
                            ? 'border-chroma/70 bg-chroma/10 text-paper'
                            : 'border-ink-700 bg-ink-800/60 text-haze hover:border-ink-600 hover:text-paper'}`}
            >
              <span className="text-meta font-semibold">
                {isToday ? 'Today' : d.label.split(',')[0]}
              </span>
              <span className="text-micro text-haze/70">
                {d.entries.length} {d.entries.length === 1 ? 'episode' : 'episodes'}
              </span>
            </button>
          );
        })}
      </nav>

      {shown && (
        <div className="gutter-x">
          <h2 className="mb-4 text-meta font-semibold uppercase tracking-wider text-haze/70">
            {shown.label}
          </h2>

          <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {shown.entries.map((entry) => {
              const chroma = toChromaVar(entry.media.coverImage.color);
              const until = entry.airingAt - now;
              const aired = until <= 0;

              return (
                <li key={entry.id} style={{ ['--chroma' as string]: chroma }}>
                  <Link
                    href={`/title/${entry.media.id}`}
                    className={`group flex items-center gap-3 rounded-panel border border-ink-700
                                bg-ink-800/60 p-2.5 transition-all duration-200 ease-physical
                                hover:-translate-y-0.5 hover:border-chroma/60 hover:bg-ink-700/60
                                ${aired ? 'opacity-65' : ''}`}
                  >
                    <span className="relative h-[76px] w-[54px] shrink-0 overflow-hidden rounded bg-ink-700">
                      {entry.media.coverImage.large && (
                        <Image
                          src={entry.media.coverImage.large}
                          alt=""
                          fill
                          sizes="54px"
                          className="object-cover"
                        />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-micro font-semibold text-chroma">
                        <Clock size={11} aria-hidden />
                        {airTime(entry.airingAt)}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-meta font-semibold leading-snug text-paper">
                        {displayTitle(entry.media.title)}
                      </span>
                      <span className="mt-1 block text-micro text-haze">
                        Episode {entry.episode}
                        {!aired && until > 0 ? ` · in ${countdown(until)}` : ' · aired'}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
