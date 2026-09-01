import { create } from 'zustand';
import type { AppSettings } from '@/types';
import { appStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/constants';

const defaultSettings: AppSettings = {
  language: 'tr',
  theme: 'dark',
  soundEffects: true,
  vibration: true,
  dataSaving: false,
  notifications: {
    quizSolved: true,
    newQuiz: true,
    friendInvite: true,
    results: true,
  },
};

interface SettingsStore {
  settings: AppSettings;
  isLoaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<AppSettings>) => Promise<void>;
  updateNotifications: (partial: Partial<AppSettings['notifications']>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,

  load: async () => {
    const saved = await appStorage.getJSON<AppSettings>(STORAGE_KEYS.settings);
    set({ settings: saved ?? defaultSettings, isLoaded: true });
  },

  update: async (partial) => {
    const settings = { ...get().settings, ...partial };
    await appStorage.setJSON(STORAGE_KEYS.settings, settings);
    set({ settings });
  },

  updateNotifications: async (partial) => {
    const settings = {
      ...get().settings,
      notifications: { ...get().settings.notifications, ...partial },
    };
    await appStorage.setJSON(STORAGE_KEYS.settings, settings);
    set({ settings });
  },
}));
