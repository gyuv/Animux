'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Synopses run from two lines to twelve paragraphs. Rather than clamping
 * everything to the same arbitrary height, this measures the text and only
 * offers the expander when there is actually something hidden — a "Read more"
 * that reveals one extra line is worse than no expander at all.
 */
export function Synopsis({ text }: { text: string }) {
  const body = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 12);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  if (!text) return null;

  return (
    <div className="relative">
      <p
        ref={body}
        className={`prose-anime transition-[max-height] duration-500 ease-physical
                    ${expanded ? 'max-h-[2000px]' : 'max-h-[7.4rem] overflow-hidden'}`}
      >
        {text}
      </p>

      {!expanded && overflows && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-14
                     bg-gradient-to-t from-ink-900 to-transparent"
          aria-hidden
        />
      )}

      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="relative mt-2 inline-flex items-center gap-1 text-meta font-semibold
                     text-chroma transition-opacity hover:opacity-80"
        >
          {expanded ? 'Show less' : 'Read the full synopsis'}
          <ChevronDown
            size={15}
            aria-hidden
            className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
