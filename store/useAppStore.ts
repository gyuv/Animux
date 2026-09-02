import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export interface UserProgress {
  animeId: string;
  episode: number;
  timestamp: number;
  watchedPercentage: number;
}

export interface UserPreferences {
  defaultAudio: 'sub' | 'dub' | 'auto';
  subtitleSize: 'small' | 'medium' | 'large';
  skipIntro: boolean;
  theme: 'dark' | 'oled' | 'dim';
}

interface AppState {
  continueWatching: UserProgress[];
  updateProgress: (animeId: string, timestamp: number, percentage: number, episode?: number) => void;
  syncWithCloud: (userId: string) => Promise<void>;
  
  preferences: UserPreferences;
  updatePreferences: (prefs: Partial<UserPreferences>, userId?: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      continueWatching: [],
      
      updateProgress: async (animeId, timestamp, percentage, episode = 1) => {
        set((state) => {
          const exists = state.continueWatching.find(w => w.animeId === animeId);
          const updatedItem = { animeId, episode, timestamp, watchedPercentage: percentage };
          const newHistory = exists
            ? state.continueWatching.map(w => w.animeId === animeId ? updatedItem : w)
            : [updatedItem, ...state.continueWatching];
          return { continueWatching: newHistory.slice(0, 50) };
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase.from('watch_history').upsert({
            user_id: session.user.id,
            anime_id: animeId,
            episode,
            timestamp,
            watched_percentage: percentage,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,anime_id' });
        }
      },

      syncWithCloud: async (userId: string) => {
        try {
          const { data: historyData } = await supabase
            .from('watch_history')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (historyData) {
            set({
              continueWatching: historyData.map((item: any) => ({
                animeId: item.anime_id,
                episode: item.episode,
                timestamp: item.timestamp,
                watchedPercentage: item.watched_percentage,
              }))
            });
          }

          if (profileData) {
            set({
              preferences: {
                defaultAudio: profileData.default_audio,
                subtitleSize: profileData.subtitle_size,
                skipIntro: profileData.skip_intro,
                theme: profileData.theme,
              }
            });
          }
        } catch (error) {
          console.error('Error syncing with Supabase:', error);
        }
      },

      preferences: {
        defaultAudio: 'auto',
        subtitleSize: 'medium',
        skipIntro: true,
        theme: 'oled'
      },

      updatePreferences: async (prefs, userId) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs }
        }));

        if (userId) {
          await supabase.from('profiles').update({
            default_audio: prefs.defaultAudio,
            subtitle_size: prefs.subtitleSize,
            skip_intro: prefs.skipIntro,
            theme: prefs.theme,
            updated_at: new Date().toISOString(),
          }).eq('id', userId);
        }
      }
    }),
    {
      name: 'animux-storage',
    }
  )
);
