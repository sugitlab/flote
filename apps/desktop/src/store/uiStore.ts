import { create } from "zustand";
import type { DarkCodeTheme, LightCodeTheme } from "@flote/types";

export type ThemeMode = "dark" | "light" | "system";
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
  activeTab: "notes" | "tasks";
  toasts: Toast[];
  searchFullText: boolean;
  hideCompletedInSearch: boolean;
  vimMode: boolean;
  sidebarCollapsed: boolean;
  supabaseReady: boolean;
  setSupabaseReady: (v: boolean) => void;
  setVimMode: (v: boolean) => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  setEditorThemeDark: (theme: DarkEditorTheme) => void;
  setEditorThemeLight: (theme: LightEditorTheme) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveTab: (tab: "notes" | "tasks") => void;
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
  setSearchFullText: (v: boolean) => void;
  setHideCompletedInSearch: (v: boolean) => void;
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
  sidebarCollapsed: false,
  supabaseReady: false,

  setSupabaseReady: (v) => set({ supabaseReady: v }),
  setVimMode: (v) => set({ vimMode: v }),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setEditorThemeDark: (editorThemeDark) => set({ editorThemeDark }),
  setEditorThemeLight: (editorThemeLight) => set({ editorThemeLight }),
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
