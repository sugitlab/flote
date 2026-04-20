import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export const Colors = {
  light: {
    background: "#ffffff",
    surface: "#f2f2f7",
    text: "#000000",
    textSecondary: "#3c3c43",
    border: "rgba(0,0,0,0.1)",
    accent: "#007aff",
    danger: "#ff3b30",
  },
  dark: {
    background: "#000000",
    surface: "#1c1c1e",
    text: "#ffffff",
    textSecondary: "rgba(235,235,245,0.6)",
    border: "rgba(255,255,255,0.1)",
    accent: "#0a84ff",
    danger: "#ff453a",
  },
} as const;

export type ThemeColors = (typeof Colors)["light"];
export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "flote_theme_mode";

type ThemeStore = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  loadMode: () => Promise<void>;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: "system",
  setMode: async (mode) => {
    set({ mode });
    await SecureStore.setItemAsync(THEME_KEY, mode);
  },
  loadMode: async () => {
    const stored = await SecureStore.getItemAsync(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      set({ mode: stored });
    }
  },
}));

export function useTheme() {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);

  const isDark =
    mode === "dark" ? true :
    mode === "light" ? false :
    systemScheme === "dark";

  const colors = isDark ? Colors.dark : Colors.light;
  return { colors, isDark, mode };
}
