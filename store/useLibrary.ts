'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * The viewer's library: what they're partway through, what they've saved,
 * and how they like their audio and subtitles.
 *
 * Local-first by design. The previous version imported a Supabase client at
 * module scope and fired a network write on every progress tick — which threw
 * on load whenever the environment variables were absent, and hammered the
 * database roughly twice a second during playback. Sync is now an optional
 * adapter that the app injects if and when a backend exists, and progress is
 * throttled before it ever leaves the device.
 */

export interface WatchProgress {
  animeId: string;
  title: string;
  cover: string;
  color: string | null;
  episode: number;
  /** Seconds into the episode. */
  position: number;
  duration: number;
  updatedAt: number;
}

export interface Preferences {
  /** Which audio to pick when a release offers both. */
  audio: 'sub' | 'dub';
  /** BCP-47 tag, or 'off'. */
  subtitleLang: string;
  subtitleSize: 'small' | 'medium' | 'large';
  autoSkipIntro: boolean;
  autoPlayNext: boolean;
  /** Preferred spoken language when a title ships several dubs. */
  audioLang: string;
  /** Carried across episodes so the player never starts loud. */
  volume: number;
  muted: boolean;
  playbackRate: number;
}

export interface SyncAdapter {
  pull(): Promise<{ progress: WatchProgress[]; preferences: Partial<Preferences> } | null>;
  push(payload: { progress: WatchProgress[]; preferences: Preferences }): Promise<void>;
}

interface LibraryState {
  progress: WatchProgress[];
  saved: string[];
  preferences: Preferences;
  sync: SyncAdapter | null;
  /** False until localStorage has been read, so nothing renders a wrong
   *  "Resume" button on the server and then corrects itself on hydration. */
  hydrated: boolean;

  recordProgress(entry: Omit<WatchProgress, 'updatedAt'>): void;
  clearProgress(animeId: string): void;
  progressFor(animeId: string, episode?: number): WatchProgress | undefined;
  continueWatching(): WatchProgress[];

  toggleSaved(animeId: string): void;
  isSaved(animeId: string): boolean;

  setPreferences(next: Partial<Preferences>): void;
  markHydrated(): void;

  attachSync(adapter: SyncAdapter): void;
  pullRemote(): Promise<void>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  audio: 'sub',
  subtitleLang: 'en',
  subtitleSize: 'medium',
  autoSkipIntro: true,
  autoPlayNext: true,
  audioLang: 'ja',
  volume: 1,
  muted: false,
  playbackRate: 1,
};

/** Below this, the viewer effectively hasn't started; above, they've finished. */
const STARTED = 0.02;
const FINISHED = 0.92;
const MAX_ENTRIES = 40;

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      progress: [],
      saved: [],
      sync: null,
      hydrated: false,
      preferences: { ...DEFAULT_PREFERENCES },

      recordProgress(entry) {
        const ratio = entry.duration > 0 ? entry.position / entry.duration : 0;
        const rest = get().progress.filter(
          (p) => !(p.animeId === entry.animeId && p.episode === entry.episode),
        );

        // A finished episode leaves the shelf rather than sitting at 99%.
        const next =
          ratio >= FINISHED
            ? rest
            : [{ ...entry, updatedAt: Date.now() }, ...rest].slice(0, MAX_ENTRIES);

        set({ progress: next });

        // Coalesce remote writes: one push at most every 15 seconds.
        const adapter = get().sync;
        if (adapter && !pushTimer) {
          pushTimer = setTimeout(() => {
            pushTimer = null;
            const s = get();
            adapter.push({ progress: s.progress, preferences: s.preferences }).catch(() => {
              /* Sync is best-effort; the local copy is the source of truth. */
            });
          }, 15_000);
        }
      },

      clearProgress(animeId) {
        set({ progress: get().progress.filter((p) => p.animeId !== animeId) });
      },

      progressFor(animeId, episode) {
        return get().progress.find(
          (p) => p.animeId === animeId && (episode === undefined || p.episode === episode),
        );
      },

      continueWatching() {
        return get()
          .progress.filter((p) => {
            const ratio = p.duration > 0 ? p.position / p.duration : 0;
            return ratio > STARTED && ratio < FINISHED;
          })
          .sort((a, b) => b.updatedAt - a.updatedAt);
      },

      toggleSaved(animeId) {
        const saved = get().saved;
        set({
          saved: saved.includes(animeId)
            ? saved.filter((id) => id !== animeId)
            : [animeId, ...saved],
        });
      },

      isSaved(animeId) {
        return get().saved.includes(animeId);
      },

      setPreferences(next) {
        set({ preferences: { ...get().preferences, ...next } });
      },

      markHydrated() {
        set({ hydrated: true });
      },

      attachSync(adapter) {
        set({ sync: adapter });
      },

      async pullRemote() {
        const adapter = get().sync;
        if (!adapter) return;
        const remote = await adapter.pull().catch(() => null);
        if (!remote) return;

        // Last write wins per episode, so a phone and a TV converge.
        const merged = new Map<string, WatchProgress>();
        for (const entry of [...get().progress, ...remote.progress]) {
          const key = `${entry.animeId}:${entry.episode}`;
          const existing = merged.get(key);
          if (!existing || entry.updatedAt > existing.updatedAt) merged.set(key, entry);
        }

        set({
          progress: [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ENTRIES),
          preferences: { ...get().preferences, ...remote.preferences },
        });
      },
    }),
    {
      name: 'animux.library',
      version: 3,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ progress: s.progress, saved: s.saved, preferences: s.preferences }),
      // A stored v2 payload is missing the preferences added since; merging
      // over the defaults means an upgrade never lands a viewer on
      // `preferences.volume === undefined` and a muted player.
      migrate: (persisted, version) => {
        const state = persisted as Partial<LibraryState> | undefined;
        if (!state) return persisted as LibraryState;
        if (version < 3) {
          return {
            ...state,
            preferences: { ...DEFAULT_PREFERENCES, ...(state.preferences ?? {}) },
          } as LibraryState;
        }
        return state as LibraryState;
      },
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
