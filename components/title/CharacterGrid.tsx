'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Mic } from 'lucide-react';
import type { CharacterEdge } from '@/services/anilist';
import { roleLabel } from '@/lib/format';

/**
 * Character and voice actor as one object with two faces.
 *
 * Every other site puts the character on the left and the actor on the right,
 * which doubles the width of the row and halves how many fit on screen. Here
 * the card holds both portraits back to back and turns over on hover or focus
 * — the pairing is the information, so it lives in one object rather than two
 * columns that happen to be adjacent.
 */
export function CharacterGrid({ edges }: { edges: CharacterEdge[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? edges : edges.slice(0, 12);

  if (edges.length === 0) {
    return <p className="text-meta text-haze">No cast has been credited yet.</p>;
  }

  return (
    <section>
      <ul className="grid gap-x-3 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(124px,1fr))]">
        {visible.map((edge) => (
          <li key={edge.id}>
            <CharacterCard edge={edge} />
          </li>
        ))}
      </ul>

      {edges.length > 12 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="key-ghost mt-6"
        >
          {showAll ? 'Show fewer' : `Show all ${edges.length}`}
        </button>
      )}
    </section>
  );
}

function CharacterCard({ edge }: { edge: CharacterEdge }) {
  const actor = edge.voiceActors?.[0];
  const [flipped, setFlipped] = useState(false);
  const canFlip = Boolean(actor);

  return (
    <div
      className="group"
      onMouseEnter={() => canFlip && setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onFocus={() => canFlip && setFlipped(true)}
      onBlur={() => setFlipped(false)}
    >
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-art bg-ink-800
                   ring-1 ring-inset ring-white/[0.06] transition-transform duration-300
                   ease-physical group-hover:-translate-y-1"
      >
        <Portrait src={edge.node.image?.large} label={edge.node.name.full ?? ''} visible={!flipped} />
        {actor && (
          <Portrait src={actor.image?.large} label={actor.name.full ?? ''} visible={flipped} />
        )}

        {/* The role sits on the artwork rather than under it — two lines of
            metadata beneath a 3:4 portrait costs a whole row of cards. */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16
                         bg-gradient-to-t from-black/85 to-transparent" aria-hidden />
        <span className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
          {flipped && actor ? (
            <>
              <Mic size={11} className="shrink-0 text-chroma" aria-hidden />
              <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-chroma">
                {actor.languageV2 ?? 'Voice'}
              </span>
            </>
          ) : (
            <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-haze">
              {roleLabel(edge.role)}
            </span>
          )}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-meta font-semibold leading-snug text-paper">
        {flipped && actor ? actor.name.full : edge.node.name.full}
      </p>
      {!flipped && edge.node.name.native && (
        <p className="mt-0.5 truncate text-micro text-haze/70">{edge.node.name.native}</p>
      )}
      {flipped && actor && (
        <p className="mt-0.5 truncate text-micro text-haze/70">
          voices {edge.node.name.full}
        </p>
      )}
    </div>
  );
}

function Portrait({ src, label, visible }: { src?: string | null; label: string; visible: boolean }) {
  return (
    <span
      className={`absolute inset-0 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      aria-hidden={!visible}
    >
      {src ? (
        <Image src={src} alt={label} fill sizes="140px" className="object-cover object-top" />
      ) : (
        <span className="grid h-full w-full place-items-center bg-ink-700 text-micro text-haze">
          No portrait
        </span>
      )}
    </span>
  );
}
