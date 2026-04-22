import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export const Colors = {
  light: {
    background: "#FAFAFE",
    surface: "#F3F3F8",
    text: "#3D3D5C",
    textSecondary: "#5C5C7A",
    border: "#D5D5E0",
    accent: "#4A4AEB",
    danger: "#E03131",
  },
  dark: {
    background: "#161625",
    surface: "#212136",
    text: "#EAEAF4",
    textSecondary: "#8585A8",
    border: "rgba(255,255,255,0.08)",
    accent: "#7B84FC",
    danger: "#F03E3E",
  },
} as const;

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
  danger: string;
};
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
