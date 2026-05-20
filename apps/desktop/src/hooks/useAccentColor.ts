import { useEffect } from "react";
import { useUIStore, type AccentColor } from "../store/uiStore";
import { getConfig, setConfig } from "../config";

async function applyWindowIcon(accent: AccentColor) {
  try {
    const { resolveResource } = await import("@tauri-apps/api/path");
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const resourcePath = await resolveResource(`icons/accent-${accent}.png`);
    await getCurrentWindow().setIcon(resourcePath);
  } catch (e) {
    console.warn("[accent] setIcon failed", e);
  }
}

function applyAccentAttr(accent: AccentColor) {
  if (accent === "blueberry") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
}

export function useAccentColor() {
  const accentColor = useUIStore((s) => s.accentColor);
  const setAccentColor = useUIStore((s) => s.setAccentColor);

  useEffect(() => {
    getConfig().then((config) => {
      setAccentColor(config.accentColor ?? "blueberry");
    });
  }, [setAccentColor]);

  useEffect(() => {
    applyAccentAttr(accentColor);
    applyWindowIcon(accentColor);
  }, [accentColor]);

  const changeAccent = (color: AccentColor) => {
    setAccentColor(color);
    setConfig({ accentColor: color });
  };

  return { accentColor, changeAccent };
}
