import { PosterSkeleton } from '@/components/media/PosterCard';

/**
 * Shown while a route's data resolves.
 *
 * Shaped like the page it precedes rather than being a spinner in the middle
 * of an empty screen — the hero block, then two shelves, in the proportions
 * the real page will occupy, so nothing jumps when the data lands.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="relative min-h-[84svh] sm:min-h-[78svh]" aria-hidden>
        <div className="skeleton absolute inset-0" />
        <div className="gutter-x relative flex min-h-[84svh] flex-col justify-end pb-16 sm:min-h-[78svh]">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton mt-5 h-12 w-[min(90%,470px)] rounded" />
          <div className="skeleton mt-3 h-4 w-[min(70%,320px)] rounded" />
          <div className="skeleton mt-5 h-4 w-[min(80%,420px)] rounded" />
          <div className="skeleton mt-7 h-11 w-56 rounded-key" />
        </div>
      </div>

      {[0, 1].map((row) => (
        <section key={row} className="pt-8">
          <div className="gutter-x">
            <div className="skeleton h-5 w-44 rounded" />
          </div>
          <div className="gutter-x mt-4 flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <PosterSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
