import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const REMINDER_HOUR_KEY = "flote_reminder_hour";
const DEFAULT_REMINDER_HOUR = 9;

type SettingsStore = {
  reminderHour: number;
  setReminderHour: (hour: number) => Promise<void>;
  loadSettings: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  reminderHour: DEFAULT_REMINDER_HOUR,

  setReminderHour: async (hour) => {
    set({ reminderHour: hour });
    await SecureStore.setItemAsync(REMINDER_HOUR_KEY, String(hour));
  },

  loadSettings: async () => {
    const stored = await SecureStore.getItemAsync(REMINDER_HOUR_KEY);
    if (stored !== null) {
      const hour = parseInt(stored, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        set({ reminderHour: hour });
      }
    }
  },
}));
