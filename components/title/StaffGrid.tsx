import Image from 'next/image';
import type { StaffEdge } from '@/services/anilist';

/**
 * Staff, credited by job. The director and the composer are the two names most
 * viewers actually recognise, so the role is set above the name rather than
 * below it — you scan for "Director", then read who.
 */
export function StaffGrid({ edges }: { edges: StaffEdge[] }) {
  if (edges.length === 0) {
    return <p className="text-meta text-haze">No staff have been credited yet.</p>;
  }

  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
      {edges.map((edge) => (
        <li
          key={edge.id}
          className="flex items-center gap-3 rounded-panel border border-ink-700
                     bg-ink-800/60 p-2.5 transition-colors duration-200 hover:border-ink-600"
        >
          <span className="relative h-[58px] w-[44px] shrink-0 overflow-hidden rounded bg-ink-700">
            {edge.node.image?.large && (
              <Image
                src={edge.node.image.large}
                alt=""
                fill
                sizes="44px"
                className="object-cover object-top"
              />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-micro font-semibold uppercase tracking-wide text-chroma">
              {edge.role ?? 'Staff'}
            </span>
            <span className="mt-0.5 block truncate text-meta font-medium text-paper">
              {edge.node.name.full}
            </span>
            {edge.node.primaryOccupations?.[0] && (
              <span className="block truncate text-micro text-haze/70">
                {edge.node.primaryOccupations[0]}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
