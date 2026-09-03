import { PosterSkeleton } from '@/components/media/PosterCard';

export default function Loading() {
  return (
    <div className="pt-topbar" aria-busy="true" aria-label="Loading results">
      <div className="gutter-x border-b border-ink-700/60 py-4">
        <div className="flex gap-2.5">
          <div className="skeleton h-11 flex-1 rounded-key" />
          <div className="skeleton h-11 w-28 rounded-key" />
          <div className="skeleton h-11 w-36 rounded-key" />
        </div>
      </div>

      <div className="gutter-x grid gap-x-3 gap-y-7 py-7
                      [grid-template-columns:repeat(auto-fill,minmax(144px,1fr))]
                      sm:[grid-template-columns:repeat(auto-fill,minmax(164px,1fr))]">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="w-full [&>div]:w-full"><PosterSkeleton /></div>
        ))}
      </div>
    </div>
  );
}
