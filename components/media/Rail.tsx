'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * A horizontal shelf. Arrows appear on pointer devices only — on touch you
 * swipe, and on a remote the D-pad already moves focus, so a pair of chevrons
 * would just be two more things to skip past.
 */

interface Props {
  title: string;
  /** Optional short line explaining what the shelf is, when it isn't obvious. */
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function Rail({ title, note, action, children }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = () => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft > 8,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
  };

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  const nudge = (dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="relative py-6">
      <header className="gutter-x mb-3.5 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-title font-bold text-paper">{title}</h2>
          {note && <p className="mt-0.5 text-meta text-haze">{note}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <div className="hidden items-center gap-1.5 [@media(pointer:fine)]:flex">
            <Nudge dir={-1} disabled={!edges.start} onClick={() => nudge(-1)} />
            <Nudge dir={1} disabled={!edges.end} onClick={() => nudge(1)} />
          </div>
        </div>
      </header>

      {/* The fades key off the same measurement the arrows use, so the shelf
          only signals "more this way" when there actually is more. */}
      <div className="rail-edge" data-start={edges.start} data-end={edges.end}>
        <div ref={track} onScroll={measure} className="rail-scroll gutter-x pb-2">
          {children}
        </div>
      </div>
    </section>
  );
}

function Nudge({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  const Icon = dir === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
      aria-label={dir === -1 ? 'Scroll left' : 'Scroll right'}
      className="grid h-8 w-8 place-items-center rounded-full border border-ink-700
                 bg-ink-800 text-haze transition-all duration-200 ease-physical
                 hover:border-ink-600 hover:text-paper
                 disabled:pointer-events-none disabled:opacity-25"
    >
      <Icon size={17} aria-hidden />
    </button>
  );
}
