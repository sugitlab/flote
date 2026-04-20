import { useColorScheme } from "react-native";

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

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  return { colors, isDark };
}
