'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Sectioned detail without a page load.
 *
 * Every panel is rendered on the server and shipped in the same payload; the
 * tabs only toggle `hidden`. That keeps the whole page in the document for
 * search engines and for Ctrl-F, and means switching from Overview to
 * Characters is instant rather than a fetch.
 *
 * The bar sticks under the top chrome once it reaches it, because on a long
 * title page the tabs are the only way back to the top of a section.
 */

export interface TabSpec {
  id: string;
  label: string;
  /** Rendered small and dim after the label — episode or character counts. */
  count?: number | null;
}

export function TitleTabs({
  tabs,
  children,
}: {
  tabs: TabSpec[];
  children: React.ReactNode[];
}) {
  const [active, setActive] = useState(tabs[0]?.id);
  const barRef = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);

  /* Slide the underline to the active tab. Measured rather than positioned by
     index, so it stays correct at any type scale or language. */
  useEffect(() => {
    const bar = barRef.current;
    const line = indicator.current;
    if (!bar || !line) return;

    const move = () => {
      const el = bar.querySelector<HTMLElement>(`[data-tab='${active}']`);
      if (!el) return;
      line.style.width = `${el.offsetWidth}px`;
      line.style.transform = `translateX(${el.offsetLeft}px)`;
    };

    move();
    const ro = new ResizeObserver(move);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [active, tabs]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActive(tabs[(i + 1) % tabs.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive(tabs[(i - 1 + tabs.length) % tabs.length].id);
    }
  };

  return (
    <>
      {/* Parks under the fixed top chrome rather than behind it. */}
      <div className="sticky top-topbar z-20 -mx-gutter mt-10 border-b border-ink-700/70
                      bg-ink-900/85 px-gutter backdrop-blur-xl">
        <div
          ref={barRef}
          role="tablist"
          aria-label="Title sections"
          onKeyDown={onKeyDown}
          className="relative flex gap-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {tabs.map((tab) => {
            const on = tab.id === active;
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`panel-${tab.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(tab.id)}
                className={`shrink-0 whitespace-nowrap px-3.5 py-3.5 text-meta font-semibold
                            transition-colors duration-200
                            ${on ? 'text-paper' : 'text-haze hover:text-paper'}`}
              >
                {tab.label}
                {tab.count ? (
                  <span className={`ml-1.5 text-micro font-medium ${on ? 'text-chroma' : 'text-haze/60'}`}>
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}

          <span
            ref={indicator}
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-full bg-chroma
                       transition-[transform,width] duration-300 ease-physical"
          />
        </div>
      </div>

      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={tab.id}
          hidden={tab.id !== active}
          className="pt-7 animate-fade"
        >
          {children[i]}
        </div>
      ))}
    </>
  );
}
