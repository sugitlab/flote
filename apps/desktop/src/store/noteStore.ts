import { create } from "zustand";
import type { Note } from "@flote/types";
import type { NoteRepository } from "@flote/api-client";

type NoteStore = {
  notes: Note[];
  activeNoteId: string | null;
  repo: NoteRepository | null;
  initStore: (repo: NoteRepository) => void;
  fetchNotes: (userId?: string) => Promise<void>;
  saveNote: (note: Note, userId?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setActiveNote: (id: string | null) => void;
  applyRemoteChange: (
    eventType: "INSERT" | "UPDATE" | "DELETE",
    note: Note
  ) => void;
};

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  repo: null,

  initStore: (repo: NoteRepository) => {
    set({ repo });
  },

  fetchNotes: async (userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const notes = await repo.getNotes(userId);
    set({ notes });
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
      await repo.saveNote(note, userId);
    } catch {
      set({ notes: prev });
    }
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
    } catch {
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
      case "UPDATE":
        set({
          notes: notes.map((n) => (n.id === note.id ? note : n)),
        });
        break;
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
