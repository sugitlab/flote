import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { changeIcon, resetIcon } from "react-native-change-icon";
import {
  DARK_CODE_THEME_OPTIONS,
  LIGHT_CODE_THEME_OPTIONS,
  type DarkCodeTheme,
  type LightCodeTheme,
} from "@flote/types";
import type { Language } from "../i18n";

export type AccentColor = "blueberry" | "cherry" | "kiwi" | "orange";

export type { DarkCodeTheme, LightCodeTheme };
export { DARK_CODE_THEME_OPTIONS, LIGHT_CODE_THEME_OPTIONS };

const IOS_ICON_MAP: Record<AccentColor, string | null> = {
  blueberry: null,
  cherry: "AppIconCherry",
  kiwi: "AppIconKiwi",
  orange: "AppIconOrange",
};

const ANDROID_ICON_MAP: Record<AccentColor, string> = {
  blueberry: "Default",
  cherry: "Cherry",
  kiwi: "Kiwi",
  orange: "Orange",
};

async function applyAppIcon(color: AccentColor): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      const name = IOS_ICON_MAP[color];
      if (name === null) {
        await resetIcon();
      } else {
        await changeIcon(name);
      }
    } else if (Platform.OS === "android") {
      await changeIcon(ANDROID_ICON_MAP[color]);
    }
  } catch {
    // icon switching not critical; silently ignore
  }
}

const MERMAID_HAND_DRAWN_KEY = "flote_mermaid_hand_drawn";
const REMINDER_HOUR_KEY = "flote_reminder_hour";
const SEARCH_FULL_TEXT_KEY = "flote_search_full_text";
const HIDE_COMPLETED_TASKS_KEY = "flote_hide_completed_tasks";
const CODE_THEME_DARK_KEY = "flote_code_theme_dark";
const CODE_THEME_LIGHT_KEY = "flote_code_theme_light";
const CUSTOM_SUPABASE_URL_KEY = "flote_custom_supabase_url";
const CUSTOM_SUPABASE_KEY_KEY = "flote_custom_supabase_key";
const LANGUAGE_KEY = "flote_language";
const DEFAULT_REMINDER_HOUR = 9;
const ACCENT_COLOR_KEY = "flote_accent_color";

type SettingsStore = {
  mermaidHandDrawn: boolean;
  reminderHour: number;
  searchFullText: boolean;
  hideCompletedTasks: boolean;
  codeThemeDark: DarkCodeTheme;
  codeThemeLight: LightCodeTheme;
  customSupabaseUrl: string;
  customSupabaseAnonKey: string;
  language: Language;
  accentColor: AccentColor;
  setMermaidHandDrawn: (v: boolean) => Promise<void>;
  setReminderHour: (hour: number) => Promise<void>;
  setSearchFullText: (v: boolean) => Promise<void>;
  setHideCompletedTasks: (v: boolean) => Promise<void>;
  setCodeThemeDark: (theme: DarkCodeTheme) => Promise<void>;
  setCodeThemeLight: (theme: LightCodeTheme) => Promise<void>;
  setCustomSupabase: (url: string, anonKey: string) => Promise<void>;
  clearCustomSupabase: () => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  setAccentColor: (color: AccentColor) => Promise<void>;
  loadSettings: () => Promise<void>;
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  mermaidHandDrawn: false,
  reminderHour: DEFAULT_REMINDER_HOUR,
  searchFullText: false,
  hideCompletedTasks: false,
  codeThemeDark: "oneDark",
  codeThemeLight: "github",
  customSupabaseUrl: "",
  customSupabaseAnonKey: "",
  language: "ja",
  accentColor: "blueberry",

  setMermaidHandDrawn: async (v) => {
    set({ mermaidHandDrawn: v });
    await SecureStore.setItemAsync(MERMAID_HAND_DRAWN_KEY, v ? "1" : "0");
  },

  setReminderHour: async (hour) => {
    set({ reminderHour: hour });
    await SecureStore.setItemAsync(REMINDER_HOUR_KEY, String(hour));
  },

  setSearchFullText: async (v) => {
    set({ searchFullText: v });
    await SecureStore.setItemAsync(SEARCH_FULL_TEXT_KEY, v ? "1" : "0");
  },

  setHideCompletedTasks: async (v) => {
    set({ hideCompletedTasks: v });
    await SecureStore.setItemAsync(HIDE_COMPLETED_TASKS_KEY, v ? "1" : "0");
  },

  setCodeThemeDark: async (theme) => {
    set({ codeThemeDark: theme });
    await SecureStore.setItemAsync(CODE_THEME_DARK_KEY, theme);
  },

  setCodeThemeLight: async (theme) => {
    set({ codeThemeLight: theme });
    await SecureStore.setItemAsync(CODE_THEME_LIGHT_KEY, theme);
  },

  setCustomSupabase: async (url, anonKey) => {
    set({ customSupabaseUrl: url, customSupabaseAnonKey: anonKey });
    await SecureStore.setItemAsync(CUSTOM_SUPABASE_URL_KEY, url);
    await SecureStore.setItemAsync(CUSTOM_SUPABASE_KEY_KEY, anonKey);
  },

  clearCustomSupabase: async () => {
    set({ customSupabaseUrl: "", customSupabaseAnonKey: "" });
    await SecureStore.deleteItemAsync(CUSTOM_SUPABASE_URL_KEY);
    await SecureStore.deleteItemAsync(CUSTOM_SUPABASE_KEY_KEY);
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    await SecureStore.setItemAsync(LANGUAGE_KEY, lang);
  },

  setAccentColor: async (color) => {
    set({ accentColor: color });
    await SecureStore.setItemAsync(ACCENT_COLOR_KEY, color);
    applyAppIcon(color).catch(() => {});
  },

  loadSettings: async () => {
    const [
      hourStr, searchStr, hideCompletedStr,
      darkThemeStr, lightThemeStr,
      customUrlStr, customKeyStr,
      languageStr, accentStr, mermaidHandDrawnStr,
    ] = await Promise.all([
      SecureStore.getItemAsync(REMINDER_HOUR_KEY),
      SecureStore.getItemAsync(SEARCH_FULL_TEXT_KEY),
      SecureStore.getItemAsync(HIDE_COMPLETED_TASKS_KEY),
      SecureStore.getItemAsync(CODE_THEME_DARK_KEY),
      SecureStore.getItemAsync(CODE_THEME_LIGHT_KEY),
      SecureStore.getItemAsync(CUSTOM_SUPABASE_URL_KEY),
      SecureStore.getItemAsync(CUSTOM_SUPABASE_KEY_KEY),
      SecureStore.getItemAsync(LANGUAGE_KEY),
      SecureStore.getItemAsync(ACCENT_COLOR_KEY),
      SecureStore.getItemAsync(MERMAID_HAND_DRAWN_KEY),
    ]);
    const next: Partial<SettingsStore> = {};
    if (mermaidHandDrawnStr !== null) next.mermaidHandDrawn = mermaidHandDrawnStr === "1";
    if (hourStr !== null) {
      const hour = parseInt(hourStr, 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) next.reminderHour = hour;
    }
    if (searchStr !== null) next.searchFullText = searchStr === "1";
    if (hideCompletedStr !== null) next.hideCompletedTasks = hideCompletedStr === "1";
    if (darkThemeStr !== null) next.codeThemeDark = darkThemeStr as DarkCodeTheme;
    if (lightThemeStr !== null) next.codeThemeLight = lightThemeStr as LightCodeTheme;
    if (customUrlStr !== null) next.customSupabaseUrl = customUrlStr;
    if (customKeyStr !== null) next.customSupabaseAnonKey = customKeyStr;
    if (languageStr === "ja" || languageStr === "en") next.language = languageStr;
    if (accentStr === "blueberry" || accentStr === "cherry" || accentStr === "kiwi" || accentStr === "orange") {
      next.accentColor = accentStr;
    }
    if (Object.keys(next).length > 0) set(next as SettingsStore);
  },
}));
