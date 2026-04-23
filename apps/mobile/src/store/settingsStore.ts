import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import {
  DARK_CODE_THEME_OPTIONS,
  LIGHT_CODE_THEME_OPTIONS,
  type DarkCodeTheme,
  type LightCodeTheme,
} from "@flote/types";

export type { DarkCodeTheme, LightCodeTheme };
export { DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS };

const REMINDER_HOUR_KEY = "flote_reminder_hour";
const SEARCH_FULL_TEXT_KEY = "flote_search_full_text";
const CODE_THEME_DARK_KEY = "flote_code_theme_dark";
const CODE_THEME_LIGHT_KEY = "flote_code_theme_light";
const DEFAULT_REMINDER_HOUR = 9;

type SettingsStore = {
  reminderHour: number;
  searchFullText: boolean;
  codeThemeDark: DarkCodeTheme;
  codeThemeLight: LightCodeTheme;
  setReminderHour: (hour: number) => Promise<void>;
  setSearchFullText: (v: boolean) => Promise<void>;
  setCodeThemeDark: (theme: DarkCodeTheme) => Promise<void>;
  setCodeThemeLight: (theme: LightCodeTheme) => Promise<void>;
  loadSettings: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  reminderHour: DEFAULT_REMINDER_HOUR,
  searchFullText: false,
  codeThemeDark: "oneDark",
  codeThemeLight: "github",

  setReminderHour: async (hour) => {
    set({ reminderHour: hour });
    await SecureStore.setItemAsync(REMINDER_HOUR_KEY, String(hour));
  },

  setSearchFullText: async (v) => {
    set({ searchFullText: v });
    await SecureStore.setItemAsync(SEARCH_FULL_TEXT_KEY, v ? "1" : "0");
  },

  setCodeThemeDark: async (theme) => {
    set({ codeThemeDark: theme });
    await SecureStore.setItemAsync(CODE_THEME_DARK_KEY, theme);
  },

  setCodeThemeLight: async (theme) => {
    set({ codeThemeLight: theme });
    await SecureStore.setItemAsync(CODE_THEME_LIGHT_KEY, theme);
  },

  loadSettings: async () => {
    const [hourStr, searchStr, darkThemeStr, lightThemeStr] = await Promise.all([
      SecureStore.getItemAsync(REMINDER_HOUR_KEY),
      SecureStore.getItemAsync(SEARCH_FULL_TEXT_KEY),
      SecureStore.getItemAsync(CODE_THEME_DARK_KEY),
      SecureStore.getItemAsync(CODE_THEME_LIGHT_KEY),
    ]);
    const next: Partial<SettingsStore> = {};
    if (hourStr !== null) {
      const hour = parseInt(hourStr, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) next.reminderHour = hour;
    }
    if (searchStr !== null) next.searchFullText = searchStr === "1";
    if (darkThemeStr !== null) next.codeThemeDark = darkThemeStr as DarkCodeTheme;
    if (lightThemeStr !== null) next.codeThemeLight = lightThemeStr as LightCodeTheme;
    if (Object.keys(next).length > 0) set(next as SettingsStore);
  },
}));
