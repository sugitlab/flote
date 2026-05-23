import { create } from "zustand";
import type { DarkCodeTheme, LightCodeTheme } from "@flote/types";
import type { Language } from "../locales";

export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "blueberry" | "cherry" | "kiwi" | "orange";
export type DarkEditorTheme = DarkCodeTheme;
export type LightEditorTheme = LightCodeTheme;
export type { DarkCodeTheme, LightCodeTheme };

export type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

type UIStore = {
  theme: ThemeMode;
  editorThemeDark: DarkEditorTheme;
  editorThemeLight: LightEditorTheme;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  activeTab: "notes" | "tasks" | "expenses";
  toasts: Toast[];
  searchFullText: boolean;
  hideCompletedInSearch: boolean;
  vimMode: boolean;
  mermaidHandDrawn: boolean;
  sidebarCollapsed: boolean;
  supabaseReady: boolean;
  language: Language;
  setSupabaseReady: (v: boolean) => void;
  setLanguage: (lang: Language) => void;
  setVimMode: (v: boolean) => void;
  setMermaidHandDrawn: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  setEditorThemeDark: (theme: DarkEditorTheme) => void;
  setEditorThemeLight: (theme: LightEditorTheme) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveTab: (tab: "notes" | "tasks" | "expenses") => void;
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
  setSearchFullText: (v: boolean) => void;
  setHideCompletedInSearch: (v: boolean) => void;
  suppressHideOnBlur: boolean;
  setSuppressHideOnBlur: (v: boolean) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
};

export const useUIStore = create<UIStore>((set, get) => ({
  theme: "system",
  editorThemeDark: "oneDark",
  editorThemeLight: "github",
  isCommandPaletteOpen: true,
  isSettingsOpen: false,
  activeTab: "notes",
  toasts: [],
  searchFullText: false,
  hideCompletedInSearch: true,
  vimMode: false,
  mermaidHandDrawn: false,
  sidebarCollapsed: false,
  supabaseReady: false,
  language: "ja",
  accentColor: "blueberry",

  setSupabaseReady: (v) => set({ supabaseReady: v }),
  setLanguage: (lang) => set({ language: lang }),
  setVimMode: (v) => set({ vimMode: v }),
  setMermaidHandDrawn: (v) => set({ mermaidHandDrawn: v }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setEditorThemeDark: (editorThemeDark) => set({ editorThemeDark }),
  setEditorThemeLight: (editorThemeLight) => set({ editorThemeLight }),
  suppressHideOnBlur: false,
  setSuppressHideOnBlur: (v) => set({ suppressHideOnBlur: v }),
  setAccentColor: (accentColor) => set({ accentColor }),
  setSearchFullText: (v) => set({ searchFullText: v }),
  setHideCompletedInSearch: (v) => set({ hideCompletedInSearch: v }),

  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

  toggleCommandPalette: () =>
    set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  addToast: (type, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => get().removeToast(id), 3000);
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
