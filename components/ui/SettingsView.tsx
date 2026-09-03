'use client';

import { useEffect, useState } from 'react';
import { useLibrary, type Preferences } from '@/store/useLibrary';

/**
 * Playback defaults. These are the same values the player reads, so changing
 * "English dub" here means the next episode opens on the English track without
 * anyone touching the in-player menu.
 */

const LANGUAGES = [
  { value: 'ja', label: 'Japanese' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ar', label: 'Arabic' },
];

const SUBTITLE_LANGUAGES = [{ value: 'off', label: 'No subtitles' }, ...LANGUAGES];

export function SettingsView() {
  const [mounted, setMounted] = useState(false);
  const { preferences, setPreferences, progress, saved } = useLibrary();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const set = (patch: Partial<Preferences>) => setPreferences(patch);

  return (
    <div className="gutter-x max-w-[62ch] pb-8 pt-topbar">
      <h1 className="mt-8 font-display text-hero font-black text-paper">Settings</h1>
      <p className="mt-2 text-body text-haze">
        These are the defaults the player opens with. Anything changed inside the player
        while watching is written back here.
      </p>

      <Section title="Audio" note="What plays first when a release offers more than one track.">
        <Choice
          label="Prefer"
          value={preferences.audio}
          onChange={(v) => set({ audio: v as Preferences['audio'] })}
          options={[
            { value: 'sub', label: 'Original audio with subtitles' },
            { value: 'dub', label: 'Dubbed audio' },
          ]}
        />
        {preferences.audio === 'dub' && (
          <Choice
            label="Dub language"
            value={preferences.audioLang}
            onChange={(v) => set({ audioLang: v })}
            options={LANGUAGES.filter((l) => l.value !== 'ja')}
          />
        )}
      </Section>

      <Section title="Subtitles">
        <Choice
          label="Language"
          value={preferences.subtitleLang}
          onChange={(v) => set({ subtitleLang: v })}
          options={SUBTITLE_LANGUAGES}
        />
        <Choice
          label="Size"
          value={preferences.subtitleSize}
          onChange={(v) => set({ subtitleSize: v as Preferences['subtitleSize'] })}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
        />
      </Section>

      <Section title="Playback">
        <Choice
          label="Default speed"
          value={String(preferences.playbackRate)}
          onChange={(v) => set({ playbackRate: Number(v) })}
          options={[0.75, 1, 1.25, 1.5, 2].map((r) => ({ value: String(r), label: `${r}×` }))}
        />
        <Toggle
          label="Skip openings automatically"
          checked={preferences.autoSkipIntro}
          onChange={(v) => set({ autoSkipIntro: v })}
        />
        <Toggle
          label="Play the next episode when one ends"
          checked={preferences.autoPlayNext}
          onChange={(v) => set({ autoPlayNext: v })}
        />
        <Toggle
          label="Start muted"
          checked={preferences.muted}
          onChange={(v) => set({ muted: v })}
        />
      </Section>

      <Section title="On this device">
        <p className="text-meta text-haze">
          {progress.length} episode{progress.length === 1 ? '' : 's'} in progress,{' '}
          {saved.length} title{saved.length === 1 ? '' : 's'} saved. Everything is stored
          on this device until sync is wired up.
        </p>
        <button
          type="button"
          onClick={() => {
            if (!confirm('Clear all watch history and saved titles on this device?')) return;
            useLibrary.setState({ progress: [], saved: [] });
          }}
          className="key-ghost border-signal/40 text-signal hover:border-signal"
        >
          Clear everything on this device
        </button>
      </Section>

      <Section
        title="Keyboard"
        note="The player answers to these while anything other than a text field has focus."
      >
        <dl className="grid gap-y-2 [grid-template-columns:auto_1fr]">
          {[
            ['Space', 'Play or pause'],
            ['← →', 'Back or forward ten seconds'],
            ['F', 'Full screen'],
            ['C', 'Audio, subtitles and quality'],
            ['?', 'The full list, in the player'],
          ].map(([keys, label]) => (
            <div key={keys} className="col-span-2 flex items-center justify-between gap-4">
              <dt>
                <kbd className="rounded border border-ink-600 bg-ink-800 px-2 py-1 font-sans text-micro text-paper">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-meta text-haze">{label}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-ink-700 pt-6">
      <h2 className="font-display text-title font-bold text-paper">{title}</h2>
      {note && <p className="mt-1 text-meta text-haze">{note}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Choice({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-body text-paper">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[200px] rounded-key border border-ink-700 bg-ink-800 px-3 py-2.5
                   text-meta text-paper"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-body text-paper">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200
                    ${checked ? 'bg-chroma' : 'bg-ink-700'}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-paper transition-transform duration-200 ease-physical
                      ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  );
}
