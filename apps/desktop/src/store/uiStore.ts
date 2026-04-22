import { create } from "zustand";
import type { CodeTheme } from "@flote/types";

export type ThemeMode = "dark" | "light" | "system";
export type EditorTheme = CodeTheme;
export type { CodeTheme };

export type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

type UIStore = {
  theme: ThemeMode;
  editorTheme: EditorTheme;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  activeTab: "notes" | "tasks";
  toasts: Toast[];
  searchFullText: boolean;
  hideCompletedInSearch: boolean;
  setTheme: (theme: ThemeMode) => void;
  setEditorTheme: (theme: EditorTheme) => void;
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
  editorTheme: "oneDark",
  isCommandPaletteOpen: true,
  isSettingsOpen: false,
  activeTab: "notes",
  toasts: [],
  searchFullText: false,
  hideCompletedInSearch: true,

  setTheme: (theme) => set({ theme }),
  setEditorTheme: (editorTheme) => set({ editorTheme }),
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
