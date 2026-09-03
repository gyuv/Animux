export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading schedule">
      <div className="gutter-x pb-2 pt-24">
        <div className="skeleton h-11 w-[min(80%,420px)] rounded" />
        <div className="skeleton mt-4 h-4 w-[min(70%,520px)] rounded" />
      </div>

      <div className="gutter-x mt-6 flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-[68px] w-[124px] shrink-0 rounded-panel" />
        ))}
      </div>

      <div className="gutter-x mt-8 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="skeleton h-[100px] rounded-panel" />
        ))}
      </div>
    </div>
  );
}
