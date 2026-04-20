import { useEffect } from "react";
import { useUIStore, type ThemeMode } from "../store/uiStore";
import { getConfig, setConfig } from "../config";

function applyTheme(mode: ThemeMode) {
  let resolved: "dark" | "light";
  if (mode === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else {
    resolved = mode;
  }
  document.documentElement.setAttribute("data-theme", resolved);
}

export function useTheme() {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  // Load saved theme on mount
  useEffect(() => {
    getConfig().then((config) => {
      setTheme(config.theme);
    });
  }, [setTheme]);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme]);

  const cycleTheme = () => {
    const next: ThemeMode =
      theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
    setConfig({ theme: next });
  };

  return { theme, setTheme, cycleTheme };
}
