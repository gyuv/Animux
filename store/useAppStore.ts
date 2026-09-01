// store/useAppStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProgress {
  animeId: string;
  episode: number;
  timestamp: number; // Last watched timestamp
  watchedPercentage: number;
}

interface UserPreferences {
  defaultAudio: 'sub' | 'dub' | 'auto';
  subtitleSize: 'small' | 'medium' | 'large';
  skipIntro: boolean;
  theme: 'dark' | 'oled' | 'dim';
}

interface AppState {
  // Progress
  continueWatching: UserProgress[];
  markAsWatched: (data: UserProgress) => void;
  updateProgress: (animeId: string, timestamp: number, percentage: number) => void;
  
  // Preferences
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  
  // UI State
  isLoading: boolean;
  setLoading: (status: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  continueWatching: [], // Populated from DB on init
  markAsWatched: (data) => set((state) => {
    const exists = state.continueWatching.find(w => w.animeId === data.animeId);
    if (exists) {
      return {
        continueWatching: state.continueWatching.map(w => w.animeId === data.animeId ? data : w)
      };
    }
    return { continueWatching: [data, ...state.continueWatching].slice(0, 50) }; // Limit to last 50
  }),
  updateProgress: (animeId, timestamp, percentage) => {
    // Debounce this in the VideoPlayer component
    set((state) => {
      const exists = state.continueWatching.find(w => w.animeId === animeId);
      if (exists) {
        return {
          continueWatching: state.continueWatching.map(w => 
            w.animeId === animeId ? { ...w, timestamp, watchedPercentage: percentage } : w
          )
        };
      }
      // Add new
      return {
        continueWatching: [{ animeId, episode: 1, timestamp, watchedPercentage: percentage }, ...state.continueWatching]
      };
    });
  },

  preferences: {
    defaultAudio: 'auto',
    subtitleSize: 'medium',
    skipIntro: true,
    theme: 'oled'
  },
  updatePreferences: (prefs) => set((state) => ({
    preferences: { ...state.preferences, ...prefs }
  })),

  isLoading: false,
  setLoading: (status) => set({ isLoading: status })
}));
