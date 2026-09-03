import Image from 'next/image';
import Link from 'next/link';
import type { RelationEdge } from '@/services/anilist';
import { displayTitle } from '@/services/anilist';
import { toChromaVar } from '@/lib/chroma';
import { formatLabel, relationLabel, statusLabel } from '@/lib/format';

/**
 * Prequels, sequels, side stories and the manga it came from.
 *
 * The relation type leads, because "which one do I watch next" is the entire
 * reason this section exists — and a grid of covers with the type buried
 * underneath makes the viewer read every card to find the sequel.
 *
 * Manga and light novels are shown but not linked: this is an anime app, and a
 * link that lands on a page saying "we don't have this" is worse than a card
 * that plainly does not invite the click.
 */
export function RelationRail({ edges }: { edges: RelationEdge[] }) {
  const relations = edges.filter((e) => e.node && e.relationType !== 'CHARACTER');

  if (relations.length === 0) {
    return <p className="text-meta text-haze">Nothing else is connected to this title.</p>;
  }

  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
      {relations.map((edge) => {
        const anime = edge.node.type === 'ANIME';
        const chroma = toChromaVar(edge.node.coverImage.color);

        const inner = (
          <>
            <span className="relative h-[92px] w-[64px] shrink-0 overflow-hidden rounded bg-ink-700">
              {edge.node.coverImage.large && (
                <Image
                  src={edge.node.coverImage.large}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              )}
            </span>
            <span className="min-w-0 flex-1 py-0.5">
              <span className="block text-micro font-semibold uppercase tracking-wide text-chroma">
                {relationLabel(edge.relationType)}
              </span>
              <span className="mt-1 line-clamp-2 block text-meta font-semibold leading-snug text-paper">
                {displayTitle(edge.node.title)}
              </span>
              <span className="mt-1 block text-micro text-haze/70">
                {[
                  edge.node.type === 'MANGA' ? 'Manga' : formatLabel(edge.node.format),
                  edge.node.seasonYear,
                  statusLabel(edge.node.status),
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
          </>
        );

        const shell =
          'flex items-center gap-3 rounded-panel border border-ink-700 bg-ink-800/60 p-2.5 h-full';

        return (
          <li key={`${edge.relationType}-${edge.node.id}`} style={{ ['--chroma' as string]: chroma }}>
            {anime ? (
              <Link
                href={`/title/${edge.node.id}`}
                className={`${shell} transition-all duration-200 ease-physical
                            hover:-translate-y-0.5 hover:border-chroma/60 hover:bg-ink-700/60`}
              >
                {inner}
              </Link>
            ) : (
              <div className={`${shell} opacity-70`}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
