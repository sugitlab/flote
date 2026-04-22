import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { CODE_THEME_OPTIONS, type CodeTheme } from "@flote/types";

export type { CodeTheme };
export { CODE_THEME_OPTIONS };

const REMINDER_HOUR_KEY = "flote_reminder_hour";
const SEARCH_FULL_TEXT_KEY = "flote_search_full_text";
const CODE_THEME_KEY = "flote_code_theme";
const DEFAULT_REMINDER_HOUR = 9;

type SettingsStore = {
  reminderHour: number;
  searchFullText: boolean;
  codeTheme: CodeTheme;
  setReminderHour: (hour: number) => Promise<void>;
  setSearchFullText: (v: boolean) => Promise<void>;
  setCodeTheme: (theme: CodeTheme) => Promise<void>;
  loadSettings: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  reminderHour: DEFAULT_REMINDER_HOUR,
  searchFullText: false,
  codeTheme: "oneDark",

  setReminderHour: async (hour) => {
    set({ reminderHour: hour });
    await SecureStore.setItemAsync(REMINDER_HOUR_KEY, String(hour));
  },

  setSearchFullText: async (v) => {
    set({ searchFullText: v });
    await SecureStore.setItemAsync(SEARCH_FULL_TEXT_KEY, v ? "1" : "0");
  },

  setCodeTheme: async (theme) => {
    set({ codeTheme: theme });
    await SecureStore.setItemAsync(CODE_THEME_KEY, theme);
  },

  loadSettings: async () => {
    const [hourStr, searchStr, codeThemeStr] = await Promise.all([
      SecureStore.getItemAsync(REMINDER_HOUR_KEY),
      SecureStore.getItemAsync(SEARCH_FULL_TEXT_KEY),
      SecureStore.getItemAsync(CODE_THEME_KEY),
    ]);
    const next: Partial<SettingsStore> = {};
    if (hourStr !== null) {
      const hour = parseInt(hourStr, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) next.reminderHour = hour;
    }
    if (searchStr !== null) next.searchFullText = searchStr === "1";
    if (codeThemeStr !== null) next.codeTheme = codeThemeStr as CodeTheme;
    if (Object.keys(next).length > 0) set(next as SettingsStore);
  },
}));
