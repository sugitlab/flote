import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const REMINDER_HOUR_KEY = "flote_reminder_hour";
const SEARCH_FULL_TEXT_KEY = "flote_search_full_text";
const DEFAULT_REMINDER_HOUR = 9;

type SettingsStore = {
  reminderHour: number;
  searchFullText: boolean;
  setReminderHour: (hour: number) => Promise<void>;
  setSearchFullText: (v: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  reminderHour: DEFAULT_REMINDER_HOUR,
  searchFullText: false,

  setReminderHour: async (hour) => {
    set({ reminderHour: hour });
    await SecureStore.setItemAsync(REMINDER_HOUR_KEY, String(hour));
  },

  setSearchFullText: async (v) => {
    set({ searchFullText: v });
    await SecureStore.setItemAsync(SEARCH_FULL_TEXT_KEY, v ? "1" : "0");
  },

  loadSettings: async () => {
    const [hourStr, searchStr] = await Promise.all([
      SecureStore.getItemAsync(REMINDER_HOUR_KEY),
      SecureStore.getItemAsync(SEARCH_FULL_TEXT_KEY),
    ]);
    const next: Partial<SettingsStore> = {};
    if (hourStr !== null) {
      const hour = parseInt(hourStr, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) next.reminderHour = hour;
    }
    if (searchStr !== null) {
      next.searchFullText = searchStr === "1";
    }
    if (Object.keys(next).length > 0) set(next as SettingsStore);
  },
}));
