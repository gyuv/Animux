'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import type { StreamPayload, StreamSource } from '@/app/api/stream/route';
import type { Preferences } from '@/store/useLibrary';

/**
 * One sheet for every playback decision, in tabs rather than nested menus.
 *
 * Audio and subtitles share a tab because the two choices are made together —
 * a viewer switching to the English dub usually wants the English subtitles
 * off in the same breath — and because burying subtitles one level deeper than
 * audio is the reason nobody finds them.
 *
 * Rows are full width and generously tall so the same panel works under a
 * thumb, a cursor and a D-pad without a separate TV layout.
 */

export interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

interface Props {
  payload: StreamPayload;
  current: StreamSource | null;
  preferences: Preferences;
  levels: QualityLevel[];
  activeLevel: number;
  onPickSource: (s: StreamSource) => void;
  onPickSubtitle: (lang: string) => void;
  onPickLevel: (index: number) => void;
  onSetPreference: (next: Partial<Preferences>) => void;
  onClose: () => void;
}

const SIZES: { value: Preferences['subtitleSize']; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Tab = 'audio' | 'quality' | 'playback';

export function PlayerMenu({
  payload, current, preferences, levels, activeLevel,
  onPickSource, onPickSubtitle, onPickLevel, onSetPreference, onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('audio');

  const dubs = payload.sources.filter((s) => s.kind === 'dub');
  const subs = payload.sources.filter((s) => s.kind === 'sub');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'audio', label: 'Audio & subtitles' },
    { id: 'quality', label: 'Quality' },
    { id: 'playback', label: 'Playback' },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Close playback options"
        onClick={onClose}
        className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-label="Playback options"
        className="absolute inset-x-0 bottom-0 z-30 max-h-[78svh] overflow-y-auto rounded-t-panel
                   border-t border-ink-700 bg-ink-900/95 pb-[env(safe-area-inset-bottom)]
                   backdrop-blur-xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[400px]
                   sm:rounded-panel sm:border"
      >
        <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-900/95">
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="font-display text-title font-bold text-paper">Playback</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="text-haze hover:text-paper">
              <X size={19} aria-hidden />
            </button>
          </div>

          <div role="tablist" aria-label="Playback options" className="flex gap-1 px-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-2.5 pb-2.5 pt-1 text-meta font-semibold transition-colors
                            ${tab === t.id ? 'text-paper' : 'text-haze hover:text-paper'}`}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-chroma" aria-hidden />
                )}
              </button>
            ))}
          </div>
        </header>

        <div className="p-5 pt-4">
          {tab === 'audio' && (
            <>
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
                  <p className="px-1 py-2 text-meta text-haze">
                    No audio tracks were listed for this episode.
                  </p>
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
                <Segmented
                  options={SIZES.map((s) => ({ value: s.value, label: s.label }))}
                  value={preferences.subtitleSize}
                  onPick={(subtitleSize) => onSetPreference({ subtitleSize })}
                />
              </Section>
            </>
          )}

          {tab === 'quality' && (
            <Section label="Video quality">
              <Row
                selected={activeLevel === -1}
                onClick={() => onPickLevel(-1)}
                title="Auto"
                detail="Matches the connection, moment to moment"
              />
              {[...levels].reverse().map((l) => (
                <Row
                  key={l.index}
                  selected={activeLevel === l.index}
                  onClick={() => onPickLevel(l.index)}
                  title={l.label}
                  detail={l.bitrate ? `${Math.round(l.bitrate / 1000)} kbps` : undefined}
                />
              ))}
              {levels.length === 0 && (
                <p className="px-1 py-2 text-meta text-haze">
                  This source offers a single rendition, so there is nothing to switch between.
                </p>
              )}
            </Section>
          )}

          {tab === 'playback' && (
            <>
              <Section label="Speed">
                <Segmented
                  options={RATES.map((r) => ({ value: r, label: `${r}×` }))}
                  value={preferences.playbackRate}
                  onPick={(playbackRate) => onSetPreference({ playbackRate })}
                />
              </Section>

              <Section label="Automatic">
                <Toggle
                  label="Skip the opening"
                  detail="Jumps past the intro when the provider marks one"
                  on={preferences.autoSkipIntro}
                  onChange={(autoSkipIntro) => onSetPreference({ autoSkipIntro })}
                />
                <Toggle
                  label="Play the next episode"
                  detail="Starts the next one when this finishes"
                  on={preferences.autoPlayNext}
                  onChange={(autoPlayNext) => onSetPreference({ autoPlayNext })}
                />
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ bits */

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

function Segmented<T extends string | number>({
  options, value, onPick,
}: {
  options: { value: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onPick(o.value)}
          aria-pressed={value === o.value}
          className={`flex-1 rounded-key border py-2.5 text-meta transition-colors
            ${value === o.value
              ? 'border-chroma bg-chroma/15 text-chroma'
              : 'border-ink-700 bg-ink-800 text-haze hover:text-paper'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label, detail, on, onChange,
}: { label: string; detail?: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-key px-3 py-3
                 text-left transition-colors hover:bg-ink-800"
    >
      <span>
        <span className="block text-body text-paper">{label}</span>
        {detail && <span className="block text-micro text-haze/70">{detail}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200
                    ${on ? 'bg-chroma' : 'bg-ink-600'}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-transform
                      duration-200 ease-physical ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </span>
    </button>
  );
}
