'use client';

import { useState } from 'react';

/**
 * The loading engine, as one component.
 *
 * Everything the catalogue renders is a remote image on an open-ended set of
 * CDNs, so speed here is felt on every screen. Four things make it quick and
 * keep it from shifting the layout:
 *
 *  - Zero CLS. The wrapper reserves the exact box with `aspect-ratio` before a
 *    byte arrives, so nothing below it ever jumps.
 *  - Instant blur-up. AniList hands us a dominant colour for every title
 *    (`coverImage.color`); we paint a soft gradient of it immediately, so the
 *    tile is never an empty grey hole while the artwork decodes.
 *  - Cheap decode. `decoding="async"` keeps image decode off the main thread;
 *    `loading="lazy"` defers anything below the fold; the hero opts back in
 *    with `priority` (eager + fetchpriority=high).
 *  - Responsive bytes. `srcSet` + `sizes` let the browser pull the smallest
 *    file that fills the box on this screen.
 *
 * A plain <img> rather than next/image on purpose: covers come from a dozen
 * CDNs that cannot all be declared to the optimiser, and this needs direct
 * control of fetchpriority and the blur-up layer.
 */

interface Props {
  src: string;
  /** Second, larger source; when present a srcSet is built from the pair. */
  srcLarge?: string | null;
  /** Dominant colour as an "r g b" triple (from toChromaVar) for the blur-up. */
  color: string;
  /** CSS aspect ratio, e.g. '2 / 3' for a poster, '16 / 9' for a still. */
  ratio?: string;
  sizes?: string;
  alt?: string;
  /** Hero path: eager load + fetchpriority=high, no lazy. */
  priority?: boolean;
  className?: string;
  /** Extra classes on the <img> itself (object-position, hover scale, …). */
  imgClassName?: string;
}

export function SmartImage({
  src,
  srcLarge,
  color,
  ratio = '2 / 3',
  sizes = '(max-width: 640px) 45vw, 240px',
  alt = '',
  priority = false,
  className = '',
  imgClassName = '',
}: Props) {
  const [loaded, setLoaded] = useState(false);

  // Two widths is enough for the browser to choose sensibly; the numbers are
  // AniList's own cover sizes (large ≈ 460w, extraLarge ≈ 960w).
  const srcSet = srcLarge && srcLarge !== src ? `${src} 460w, ${srcLarge} 960w` : undefined;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: ratio,
        // The blur-up: the artwork's own colour, soft, shown until it loads.
        background: `radial-gradient(120% 120% at 30% 15%, rgb(${color} / 0.55), rgb(${color} / 0.12) 55%, rgb(14 11 21) 100%)`,
      }}
    >
      {!loaded && <span className="skeleton absolute inset-0" aria-hidden />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={600}
        height={ratio === '16 / 9' ? 338 : 900}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        // fetchPriority is valid HTML but not yet in React's types everywhere.
        {...({ fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>)}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-physical
                    ${loaded ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
      />
    </div>
  );
}
