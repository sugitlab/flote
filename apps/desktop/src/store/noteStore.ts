import { create } from "zustand";
import type { Note } from "@flote/types";
import type { NoteRepository } from "@flote/api-client";

type NoteStore = {
  notes: Note[];
  activeNoteId: string | null;
  bodyLoadedIds: Set<string>;
  repo: NoteRepository | null;
  initStore: (repo: NoteRepository) => void;
  fetchNotes: (userId?: string) => Promise<void>;
  ensureBodyMd: (id: string, userId?: string) => Promise<void>;
  saveNote: (note: Note, userId?: string) => Promise<void>;
  togglePin: (id: string, userId?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  deleteNotesBatch: (ids: string[]) => Promise<void>;
  setActiveNote: (id: string | null) => void;
  applyRemoteChange: (
    eventType: "INSERT" | "UPDATE" | "DELETE",
    note: Note
  ) => void;
};

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  bodyLoadedIds: new Set<string>(),
  repo: null,

  initStore: (repo: NoteRepository) => {
    set({ repo });
  },

  fetchNotes: async (userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const notes = await repo.getNotes(userId ?? "");
    // Top 100 come back with body_md; mark them as loaded
    const loaded = new Set(notes.slice(0, 100).map((n) => n.id));
    set({ notes, bodyLoadedIds: loaded });
  },

  ensureBodyMd: async (id: string, userId?: string) => {
    const { repo, bodyLoadedIds, notes } = get();
    if (!repo || bodyLoadedIds.has(id)) return;
    const full = await repo.getNoteById(id);
    if (!full) return;
    set({
      notes: notes.map((n) => (n.id === id ? full : n)),
      bodyLoadedIds: new Set([...bodyLoadedIds, id]),
    });
    void userId; // unused for cloud repo (already has userId in row), kept for API symmetry
  },

  saveNote: async (note: Note, userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().notes;
    const exists = prev.some((n) => n.id === note.id);
    const optimistic = exists
      ? prev.map((n) => (n.id === note.id ? note : n))
      : [note, ...prev];
    set({ notes: optimistic });

    try {
      await repo.saveNote(note, userId ?? "");
    } catch (e) {
      console.error("[noteStore] saveNote failed:", e);
      set({ notes: prev });
    }
  },

  togglePin: async (id: string, userId?: string) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    await get().saveNote({ ...note, pinned: !note.pinned }, userId);
  },

  deleteNote: async (id: string) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().notes;
    set({
      notes: prev.filter((n) => n.id !== id),
      activeNoteId: get().activeNoteId === id ? null : get().activeNoteId,
    });

    try {
      await repo.deleteNote(id);
    } catch (e) {
      console.error("[noteStore] deleteNote failed:", e);
      set({ notes: prev });
    }
  },

  deleteNotesBatch: async (ids: string[]) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().notes;
    const idSet = new Set(ids);
    set({
      notes: prev.filter((n) => !idSet.has(n.id)),
      activeNoteId: idSet.has(get().activeNoteId ?? "") ? null : get().activeNoteId,
    });

    try {
      await repo.deleteNotesBatch(ids);
    } catch (e) {
      console.error("[noteStore] deleteNotesBatch failed:", e);
      set({ notes: prev });
    }
  },

  setActiveNote: (id: string | null) => set({ activeNoteId: id }),

  applyRemoteChange: (eventType, note) => {
    const { notes } = get();
    switch (eventType) {
      case "INSERT":
        if (!notes.some((n) => n.id === note.id)) {
          set({ notes: [note, ...notes] });
        }
        break;
      case "UPDATE": {
        const local = notes.find((n) => n.id === note.id);
        // Skip if local version is already newer or equal (own echo / stale update)
        if (local && local.updated_at >= note.updated_at) break;
        set({ notes: notes.map((n) => (n.id === note.id ? note : n)) });
        break;
      }
      case "DELETE":
        set({
          notes: notes.filter((n) => n.id !== note.id),
          activeNoteId:
            get().activeNoteId === note.id ? null : get().activeNoteId,
        });
        break;
    }
  },
}));
