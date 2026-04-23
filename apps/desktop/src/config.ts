import { load } from "@tauri-apps/plugin-store";
import type { StorageMode } from "@flote/types";
import type { ThemeMode, DarkEditorTheme, LightEditorTheme } from "./store/uiStore";

export type AppSettings = {
  storageMode: StorageMode;
  theme: ThemeMode;
  editorThemeDark: DarkEditorTheme;
  editorThemeLight: LightEditorTheme;
  alwaysOnTop: boolean;
  hideOnBlur: boolean;
  launchAtLogin: boolean;
  startInTray: boolean;
  globalShortcut: string;
  searchFullText: boolean;
  hideCompletedInSearch: boolean;
  hideDockIcon: boolean;
};

const STORE_PATH = "settings.json";

const DEFAULTS: AppSettings = {
  storageMode: "local",
  theme: "system",
  editorThemeDark: "oneDark",
  editorThemeLight: "github",
  alwaysOnTop: true,
  hideOnBlur: false,
  launchAtLogin: false,
  startInTray: true,
  globalShortcut: "CmdOrCtrl+Shift+N",
  searchFullText: false,
  hideCompletedInSearch: true,
  hideDockIcon: false,
};

async function getStore() {
  return load(STORE_PATH, { autoSave: true, defaults: {} });
}

export async function getConfig(): Promise<AppSettings> {
  try {
    const store = await getStore();
    const settings: Partial<AppSettings> = {};
    for (const key of Object.keys(DEFAULTS) as (keyof AppSettings)[]) {
      const val = await store.get<AppSettings[typeof key]>(key);
      if (val !== undefined && val !== null) {
        (settings as Record<string, unknown>)[key] = val;
      }
    }
    return { ...DEFAULTS, ...settings };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setConfig(config: Partial<AppSettings>): Promise<void> {
  const store = await getStore();
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      await store.set(key, value);
    }
  }
  await store.save();
}
