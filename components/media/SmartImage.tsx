/**
 * The loading engine, as one component — and zero JavaScript.
 *
 * Every catalogue image is a remote file on an open-ended set of CDNs, so this
 * runs on every screen; it is a Server Component on purpose, so it ships no JS
 * to the browser at all. Four things keep it fast and stop it shifting layout:
 *
 *  - Zero CLS. `aspect-ratio` reserves the exact box before a byte arrives.
 *  - Instant placeholder. AniList hands us a dominant colour for every title
 *    (`coverImage.color`); we paint a soft gradient of it, so the box is never
 *    an empty hole while the artwork decodes, and the image simply paints over
 *    it on load — no fade, no state, no client hydration.
 *  - Cheap decode. `decoding="async"` keeps decode off the main thread;
 *    `loading="lazy"` defers below-the-fold work; the hero opts back in with
 *    `priority` (eager + fetchpriority=high).
 *  - Responsive bytes. `srcSet` + `sizes` pull the smallest file that fills the
 *    box on this screen.
 *
 * A plain <img> rather than next/image because covers come from a dozen CDNs
 * that cannot all be declared to the optimiser, and this needs direct control
 * of fetchpriority.
 */

interface Props {
  src: string;
  /** Second, larger source; when present a srcSet is built from the pair. */
  srcLarge?: string | null;
  /** Dominant colour as an "r g b" triple (from toChromaVar) for the placeholder. */
  color: string;
  /** CSS aspect ratio, e.g. '2 / 3' for a poster, '16 / 9' for a still. */
  ratio?: string;
  sizes?: string;
  alt?: string;
  /** Hero path: eager load + fetchpriority=high, no lazy. */
  priority?: boolean;
  className?: string;
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
  const srcSet = srcLarge && srcLarge !== src ? `${src} 460w, ${srcLarge} 960w` : undefined;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: ratio,
        background: `radial-gradient(120% 120% at 30% 12%, rgb(${color} / 0.42), rgb(${color} / 0.10) 55%, rgb(14 11 21) 100%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        width={600}
        height={ratio === '16 / 9' ? 338 : ratio === '16 / 10' ? 375 : 900}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...({ fetchpriority: priority ? 'high' : 'auto' } as Record<string, string>)}
        referrerPolicy="no-referrer"
        className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
      />
    </div>
  );
}
