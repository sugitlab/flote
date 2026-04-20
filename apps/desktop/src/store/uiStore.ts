import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system";

export type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

type UIStore = {
  theme: ThemeMode;
  isCommandPaletteOpen: boolean;
  isSettingsOpen: boolean;
  activeTab: "notes" | "tasks";
  toasts: Toast[];
  setTheme: (theme: ThemeMode) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveTab: (tab: "notes" | "tasks") => void;
  addToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: string) => void;
};

export const useUIStore = create<UIStore>((set, get) => ({
  theme: "system",
  isCommandPaletteOpen: true,
  isSettingsOpen: false,
  activeTab: "notes",
  toasts: [],

  setTheme: (theme) => set({ theme }),

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
