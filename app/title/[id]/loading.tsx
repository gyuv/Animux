/** Shaped like the title page: backdrop, poster, headline, then the tab rail. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading title">
      <div className="skeleton h-[42svh] min-h-[260px] w-full sm:h-[50svh]" />

      <div className="gutter-x relative z-10 -mt-28 sm:-mt-36">
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          <div className="skeleton aspect-[2/3] w-[136px] shrink-0 rounded-art sm:w-[204px]" />
          <div className="min-w-0 flex-1 sm:pt-28">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-7 w-20 rounded-full" />)}
            </div>
            <div className="skeleton mt-4 h-11 w-[min(90%,520px)] rounded" />
            <div className="skeleton mt-3 h-4 w-40 rounded" />
            <div className="skeleton mt-6 h-11 w-64 rounded-key" />
          </div>
        </div>

        <div className="mt-10 flex gap-4 border-b border-ink-700/70 pb-3.5 pt-3.5">
          {[64, 80, 92, 56, 84, 68].map((w, i) => (
            <div key={i} className="skeleton h-4 rounded" style={{ width: w }} />
          ))}
        </div>

        <div className="mt-7 space-y-3">
          {[92, 86, 78].map((w, i) => (
            <div key={i} className="skeleton h-4 rounded" style={{ width: `${w}%`, maxWidth: '68ch' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
