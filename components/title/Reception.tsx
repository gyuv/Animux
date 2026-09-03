'use client';

import { useState } from 'react';
import { Star, Users, Heart, Trophy } from 'lucide-react';
import type { MediaStats, Ranking } from '@/services/anilist';
import { compact, watchStatusLabel } from '@/lib/format';

/**
 * How the audience actually received this.
 *
 * Two charts and four figures. The average score is the number everyone quotes,
 * but it hides the shape of the vote — a flat 72 and a 72 split between people
 * who loved it and people who bounced off it are completely different shows,
 * and only the histogram tells you which one you are looking at.
 *
 * Colour is assigned by job, per the house rule. The histogram is one series,
 * so it is one hue — the artwork's chroma — with only the peak bucket at full
 * strength. The watch-status breakdown is five identities, so it takes the
 * fixed categorical order, and no filter or sort ever repaints them.
 */

/* Categorical slots 1-5, dark steps. Fixed per status: colour follows the
   entity, never its size, so a title where most people dropped it is not
   suddenly painted in the colour used for "Completed" elsewhere. */
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#3987e5',
  CURRENT: '#d95926',
  PLANNING: '#199e70',
  DROPPED: '#c98500',
  PAUSED: '#d55181',
};

const STATUS_ORDER = ['COMPLETED', 'CURRENT', 'PLANNING', 'PAUSED', 'DROPPED'];

export function Reception({
  stats,
  rankings,
  averageScore,
  meanScore,
  popularity,
  favourites,
}: {
  stats: MediaStats | null;
  rankings: Ranking[];
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
}) {
  const scores = (stats?.scoreDistribution ?? []).filter((d) => d.amount > 0);
  const statuses = (stats?.statusDistribution ?? []).filter((d) => d.amount > 0);
  const notable = rankings.filter((r) => r.rank <= 100);

  const nothing = scores.length === 0 && statuses.length === 0 && notable.length === 0;
  if (nothing && !averageScore) {
    return <p className="text-meta text-haze">No ratings have been recorded for this title yet.</p>;
  }

  return (
    <div className="space-y-8">
      <Figures
        averageScore={averageScore}
        meanScore={meanScore}
        popularity={popularity}
        favourites={favourites}
        bestRank={notable[0] ?? null}
      />

      {notable.length > 0 && <Rankings rankings={notable} />}

      <div className="grid gap-8 lg:grid-cols-2">
        {scores.length > 0 && <ScoreHistogram data={scores} />}
        {statuses.length > 0 && <StatusBreakdown data={statuses} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- figures */

function Figures({
  averageScore,
  meanScore,
  popularity,
  favourites,
  bestRank,
}: {
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  bestRank: Ranking | null;
}) {
  const tiles = [
    {
      label: 'Average score',
      value: averageScore ? (averageScore / 10).toFixed(1) : '—',
      unit: averageScore ? '/ 10' : '',
      icon: Star,
      note: meanScore && meanScore !== averageScore ? `mean ${(meanScore / 10).toFixed(1)}` : null,
    },
    { label: 'On watchlists', value: compact(popularity), unit: '', icon: Users, note: null },
    { label: 'Favourited', value: compact(favourites), unit: '', icon: Heart, note: null },
    {
      label: 'Best ranking',
      value: bestRank ? `#${bestRank.rank}` : '—',
      unit: '',
      icon: Trophy,
      note: bestRank ? bestRank.context : null,
    },
  ];

  return (
    <dl className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {tiles.map(({ label, value, unit, icon: Icon, note }) => (
        <div key={label} className="rounded-panel border border-ink-700 bg-ink-800/60 p-4">
          <dt className="flex items-center gap-1.5 text-micro text-haze/70">
            <Icon size={13} aria-hidden />
            {label}
          </dt>
          <dd className="mt-1.5 font-display text-title font-black tabular-nums text-paper">
            {value}
            {unit && <span className="ml-1 text-meta font-medium text-haze">{unit}</span>}
          </dd>
          {note && <p className="mt-0.5 truncate text-micro capitalize text-haze/60">{note}</p>}
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------------------------------------- rankings */

function Rankings({ rankings }: { rankings: Ranking[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {rankings.slice(0, 8).map((r) => (
        <li
          key={r.id}
          className="inline-flex items-center gap-2 rounded-full border border-ink-600
                     bg-ink-800/80 px-3 py-1.5 text-micro text-haze"
        >
          <Trophy size={12} className="text-gold" aria-hidden />
          <span className="font-semibold tabular-nums text-paper">#{r.rank}</span>
          <span className="capitalize">{r.context}</span>
          {!r.allTime && r.year ? <span className="text-haze/60">{r.year}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- histogram */

function ScoreHistogram({ data }: { data: { score: number; amount: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const sorted = [...data].sort((a, b) => a.score - b.score);
  const total = sorted.reduce((sum, d) => sum + d.amount, 0);
  const peak = sorted.reduce((best, d) => (d.amount > best.amount ? d : best), sorted[0]);

  return (
    <figure className="rounded-panel border border-ink-700 bg-ink-800/60 p-5">
      <figcaption>
        <h3 className="text-meta font-semibold text-paper">How people scored it</h3>
        <p className="mt-0.5 text-micro text-haze/70">
          {compact(total)} ratings · peak at {peak.score}
        </p>
      </figcaption>

      {/* One tick, at the top of the tallest column: the axis a reader needs to
          turn a bar height back into a number, without ten gridlines to get it. */}
      <p className="mt-5 text-micro tabular-nums text-haze/60">
        {peak.amount.toLocaleString()} ratings
      </p>
      <div className="relative mt-1 flex h-[168px] items-end gap-[2px] border-t border-ink-700">
        {sorted.map((d) => {
          const height = peak.amount > 0 ? (d.amount / peak.amount) * 100 : 0;
          const share = total > 0 ? (d.amount / total) * 100 : 0;
          const isPeak = d.score === peak.score;
          const isHover = hover === d.score;

          return (
            <button
              key={d.score}
              type="button"
              onMouseEnter={() => setHover(d.score)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(d.score)}
              onBlur={() => setHover(null)}
              aria-label={`Score ${d.score}: ${d.amount.toLocaleString()} ratings, ${share.toFixed(1)} percent`}
              className="group relative flex flex-1 flex-col justify-end self-stretch"
            >
              {/* The peak carries a direct label; everything else is on hover,
                  because a number over all ten columns is unreadable. */}
              {(isPeak || isHover) && (
                <span className="mb-1 block text-center text-[10px] font-semibold tabular-nums text-paper">
                  {share.toFixed(0)}%
                </span>
              )}
              <span
                className="mx-auto block w-full max-w-[24px] rounded-t-[4px] transition-[background-color,height] duration-300 ease-physical"
                style={{
                  height: `${Math.max(height, 1.5)}%`,
                  backgroundColor:
                    isPeak || isHover ? 'rgb(var(--chroma))' : 'rgb(var(--chroma) / 0.42)',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Hairline baseline, one step off the surface. */}
      <div className="h-px w-full bg-ink-600" aria-hidden />

      <div className="mt-1.5 flex gap-[2px]">
        {sorted.map((d) => (
          <span key={d.score} className="flex-1 text-center text-[10px] tabular-nums text-haze/60">
            {d.score}
          </span>
        ))}
      </div>

      {hover !== null && (
        <p className="mt-3 text-micro text-haze" role="status">
          <span className="font-semibold text-paper">{hover}</span> ·{' '}
          {sorted.find((d) => d.score === hover)?.amount.toLocaleString()} ratings
        </p>
      )}
    </figure>
  );
}

/* ----------------------------------------------------------- status split */

function StatusBreakdown({ data }: { data: { status: string; amount: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const ordered = STATUS_ORDER
    .map((status) => data.find((d) => d.status === status))
    .filter(Boolean) as { status: string; amount: number }[];
  const rest = data.filter((d) => !STATUS_ORDER.includes(d.status));
  const rows = [...ordered, ...rest];

  return (
    <figure className="rounded-panel border border-ink-700 bg-ink-800/60 p-5">
      <figcaption>
        <h3 className="text-meta font-semibold text-paper">What people did with it</h3>
        <p className="mt-0.5 text-micro text-haze/70">
          {compact(total)} lists · share of each state
        </p>
      </figcaption>

      {/* One 100% bar. Segments are separated by a 2px gap in the surface
          colour rather than a stroke, so no ink is spent on non-data. */}
      <div className="mt-6 flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="presentation">
        {rows.map((row, i) => (
          <span
            key={row.status}
            title={`${watchStatusLabel(row.status)}: ${row.amount.toLocaleString()}`}
            className={`block h-full transition-[flex-grow] duration-500 ease-physical
                        ${i === 0 ? 'rounded-l-full' : ''} ${i === rows.length - 1 ? 'rounded-r-full' : ''}`}
            style={{
              flexGrow: row.amount,
              flexBasis: 0,
              backgroundColor: STATUS_COLOR[row.status] ?? '#9085e9',
            }}
          />
        ))}
      </div>

      {/* Legend and table in one: identity never rests on colour alone. */}
      <ul className="mt-5 space-y-2.5">
        {rows.map((row) => (
          <li key={row.status} className="flex items-center gap-2.5 text-meta">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: STATUS_COLOR[row.status] ?? '#9085e9' }}
              aria-hidden
            />
            <span className="flex-1 text-haze">{watchStatusLabel(row.status)}</span>
            <span className="tabular-nums text-haze/60">
              {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '—'}
            </span>
            <span className="w-16 text-right font-medium tabular-nums text-paper">
              {compact(row.amount)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
