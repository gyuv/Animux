import { HeroSkeleton } from '@/components/media/Hero';
import { PosterSkeleton } from '@/components/media/PosterCard';

/**
 * Shown while a route's data resolves.
 *
 * Shaped like the page it precedes rather than being a spinner in the middle
 * of an empty screen. Because the home page now fetches its shelves in
 * sequence — deliberately, to stay under AniList's burst limiter — the first
 * paint has further to travel, and what fills that gap should look like the
 * thing arriving.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <HeroSkeleton />

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
