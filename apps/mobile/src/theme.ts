import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { useSettingsStore, type AccentColor } from "./store/settingsStore";

export type { AccentColor };

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

/*
 * 色の対称性ルール（blueberry 基準）
 * Dark: background の支配チャンネル+15、surface +21
 * Dark text: 支配チャンネル+10(primary)、+35(secondary)
 * Dark accent: 明度74%・彩度88〜93%のソフトトーン
 * Light: background の支配チャンネル+4、surface +5
 * Light text: blueberry RGB のチャンネルを各色の支配チャンネルに入替
 * Light border: 支配チャンネル+11
 */
const PALETTE: Record<AccentColor, { light: ThemeColors; dark: ThemeColors }> = {
  blueberry: {
    light: {
      background:    "#FAFAFE",
      surface:       "#F3F3F8",
      text:          "#3D3D5C",
      textSecondary: "#5C5C7A",
      border:        "#D5D5E0",
      accent:        "#4A4AEB",
      danger:        "#E03131",
    },
    dark: {
      background:    "#161625",  // RGB(22,22,37)
      surface:       "#212136",  // RGB(33,33,54)
      text:          "#EAEAF4",
      textSecondary: "#8585A8",
      border:        "rgba(255,255,255,0.08)",
      accent:        "#7B84FC",
      danger:        "#F03E3E",
    },
  },
  cherry: {
    light: {
      background:    "#FEFAFA",  // R+4
      surface:       "#F8F3F3",  // R+5
      text:          "#5C3D3D",  // R+31
      textSecondary: "#7A5C5C",
      border:        "#E0D5D5",  // R+11
      accent:        "#E5394F",
      danger:        "#E03131",
    },
    dark: {
      background:    "#251616",  // RGB(37,22,22) R+15
      surface:       "#362121",  // RGB(54,33,33) R+21
      text:          "#F4EAEA",  // R+10
      textSecondary: "#A88585",  // R+35
      border:        "rgba(255,255,255,0.08)",
      accent:        "#F77E8E",  // HSL(351°,88%,73%) blueberry 同格ソフトトーン
      danger:        "#F03E3E",
    },
  },
  kiwi: {
    light: {
      background:    "#FAFEFA",  // G+4
      surface:       "#F3F8F3",  // G+5
      text:          "#3D5C3D",  // G+31
      textSecondary: "#5C7A5C",
      border:        "#D5E0D5",  // G+11
      accent:        "#4BA24B",
      danger:        "#E03131",
    },
    dark: {
      background:    "#162516",  // RGB(22,37,22) G+15
      surface:       "#213621",  // RGB(33,54,33) G+21
      text:          "#EAF4EA",  // G+10
      textSecondary: "#85A885",  // G+35
      border:        "rgba(255,255,255,0.08)",
      accent:        "#74C874",  // HSL(120°,53%,62%) ソフトセージグリーン
      danger:        "#F03E3E",
    },
  },
  orange: {
    light: {
      background:    "#FEFBFA",  // R+4 G+1
      surface:       "#F8F6F3",  // R+5 G+3
      text:          "#5C4A3D",
      textSecondary: "#7A6352",
      border:        "#E0DBD5",
      accent:        "#FF8A1E",
      danger:        "#E03131",
    },
    dark: {
      background:    "#251E16",  // RGB(37,30,22) R+15 G+8
      surface:       "#362C21",  // RGB(54,44,33) R+21 G+11
      text:          "#F4F0EA",  // R+10 G+6
      textSecondary: "#A89478",  // R+35 G+21
      border:        "rgba(255,255,255,0.08)",
      accent:        "#FBBA6A",  // HSL(33°,93%,70%) ソフトゴールデンアンバー
      danger:        "#F03E3E",
    },
  },
};

// ── Theme mode store ──────────────────────────────────────────────
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

// ── useTheme hook ─────────────────────────────────────────────────
export function useTheme() {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((s) => s.mode);
  const accentColor = useSettingsStore((s) => s.accentColor);

  const isDark =
    mode === "dark" ? true :
    mode === "light" ? false :
    systemScheme === "dark";

  const colors = PALETTE[accentColor][isDark ? "dark" : "light"];
  return { colors, isDark, mode };
}
