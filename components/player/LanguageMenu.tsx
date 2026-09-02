'use client';
// Inside components/player/LanguageMenu.tsx
const dubs = payload.sources?.filter((s) => s.kind === 'dub') ?? [];
const subs = payload.sources?.filter((s) => s.kind === 'sub') ?? [];
import { Check, X } from 'lucide-react';
import type { StreamPayload, StreamSource } from '@/app/api/stream/route';
import type { Preferences } from '@/store/useLibrary';

/**
 * Audio and subtitles in one sheet rather than two nested menus, because
 * the two choices are made together: a viewer switching to the English dub
 * usually wants the English subtitles off in the same breath.
 *
 * Rows are full width and generously tall so the same panel works under a
 * thumb, a cursor and a D-pad without a separate TV layout.
 */

interface Props {
  payload: StreamPayload;
  current: StreamSource | null;
  preferences: Preferences;
  onPickSource: (s: StreamSource) => void;
  onPickSubtitle: (lang: string) => void;
  onSetSize: (size: Preferences['subtitleSize']) => void;
  onClose: () => void;
}

const SIZES: { value: Preferences['subtitleSize']; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export function LanguageMenu({
  payload, current, preferences, onPickSource, onPickSubtitle, onSetSize, onClose,
}: Props) {
  const dubs = payload.sources.filter((s) => s.kind === 'dub');
  const subs = payload.sources.filter((s) => s.kind === 'sub');

  return (
    <>
      <button
        type="button"
        aria-label="Close audio and subtitle options"
        onClick={onClose}
        className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-label="Audio and subtitles"
        className="absolute inset-x-0 bottom-0 z-30 max-h-[76svh] overflow-y-auto rounded-t-panel
                   border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)]
                   backdrop-blur-xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[380px]
                   sm:rounded-panel sm:border"
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-ink-700
                           bg-ink-900/95 px-5 py-4">
          <h2 className="font-display text-title font-bold text-paper">Audio and subtitles</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-haze hover:text-paper">
            <X size={19} aria-hidden />
          </button>
        </header>

        <div className="p-5 pt-4">
          <Section label="Audio">
            {subs.map((s) => (
              <Row
                key={s.id}
                selected={current?.id === s.id}
                onClick={() => onPickSource(s)}
                title={s.label}
                detail="Original audio with subtitles"
              />
            ))}
            {dubs.map((s) => (
              <Row
                key={s.id}
                selected={current?.id === s.id}
                onClick={() => onPickSource(s)}
                title={s.label}
                detail="Dubbed"
              />
            ))}
            {payload.sources.length === 0 && (
              <p className="px-1 py-2 text-meta text-haze">No audio tracks were listed for this episode.</p>
            )}
          </Section>

          <Section label="Subtitles">
            <Row
              selected={preferences.subtitleLang === 'off'}
              onClick={() => onPickSubtitle('off')}
              title="Off"
            />
            {payload.subtitles.map((s) => (
              <Row
                key={s.lang}
                selected={preferences.subtitleLang === s.lang}
                onClick={() => onPickSubtitle(s.lang)}
                title={s.label}
              />
            ))}
            {payload.subtitles.length === 0 && (
              <p className="px-1 py-2 text-meta text-haze">
                This release did not ship subtitle tracks.
              </p>
            )}
          </Section>

          <Section label="Subtitle size">
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onSetSize(s.value)}
                  aria-pressed={preferences.subtitleSize === s.value}
                  className={`flex-1 rounded-key border py-2.5 text-meta transition-colors
                    ${preferences.subtitleSize === s.value
                      ? 'border-chroma bg-chroma/15 text-chroma'
                      : 'border-ink-700 bg-ink-800 text-haze hover:text-paper'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2 text-meta font-semibold text-paper">{label}</h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Row({
  selected, onClick, title, detail,
}: { selected: boolean; onClick: () => void; title: string; detail?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center justify-between gap-3 rounded-key px-3 py-3 text-left
                  transition-colors duration-150
                  ${selected ? 'bg-ink-700' : 'hover:bg-ink-800'}`}
    >
      <span>
        <span className={`block text-body ${selected ? 'font-semibold text-paper' : 'text-haze'}`}>
          {title}
        </span>
        {detail && <span className="block text-micro text-haze/70">{detail}</span>}
      </span>
      {selected && <Check size={17} className="shrink-0 text-chroma" aria-hidden />}
    </button>
  );
}
