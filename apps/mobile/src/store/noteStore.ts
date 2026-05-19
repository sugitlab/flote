import { create } from "zustand";
import type { Note } from "@flote/types";
import { supabase } from "../lib/supabase";

type NoteStore = {
  notes: Note[];
  loading: boolean;
  activeNoteId: string | null;
  bodyLoadedIds: Set<string>;
  fetchNotes: (userId: string) => Promise<void>;
  ensureBodyMd: (id: string) => Promise<void>;
  saveNote: (note: Note, userId: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  setActiveNote: (id: string | null) => void;
};

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    body_md: (row.body_md as string) ?? "",
    updated_at: row.updated_at as string,
  };
}

const BODY_FETCH_LIMIT = 100;

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  loading: false,
  activeNoteId: null,
  bodyLoadedIds: new Set<string>(),

  fetchNotes: async (userId: string) => {
    set({ loading: true });
    try {
      const [fullRes, minimalRes] = await Promise.all([
        supabase
          .from("notes")
          .select("id, title, body_md, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(BODY_FETCH_LIMIT),
        supabase
          .from("notes")
          .select("id, title, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .range(BODY_FETCH_LIMIT, 1_000_000),
      ]);
      if (fullRes.error) throw fullRes.error;
      if (minimalRes.error) throw minimalRes.error;
      const full = (fullRes.data ?? []).map(toNote);
      const minimal = (minimalRes.data ?? []).map((r) => toNote({ ...r, body_md: "" }));
      const notes = [...full, ...minimal];
      const loaded = new Set(full.map((n) => n.id));
      set({ notes, bodyLoadedIds: loaded });
    } finally {
      set({ loading: false });
    }
  },

  ensureBodyMd: async (id: string) => {
    const { bodyLoadedIds, notes } = get();
    if (bodyLoadedIds.has(id)) return;
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, body_md, updated_at")
      .eq("id", id)
      .single();
    if (error || !data) return;
    const full = toNote(data);
    set({
      notes: notes.map((n) => (n.id === id ? full : n)),
      bodyLoadedIds: new Set([...bodyLoadedIds, id]),
    });
  },

  saveNote: async (note: Note, userId: string) => {
    const prev = get().notes;
    const exists = prev.some((n) => n.id === note.id);
    const optimistic = exists
      ? prev.map((n) => (n.id === note.id ? note : n))
      : [note, ...prev];
    set({ notes: optimistic });

    try {
      const { error } = await supabase.from("notes").upsert({
        id: note.id,
        title: note.title,
        body_md: note.body_md,
        updated_at: note.updated_at,
        user_id: userId,
      });
      if (error) throw error;
    } catch (e) {
      console.error("[noteStore] saveNote failed:", e);
      set({ notes: prev });
    }
  },

  deleteNote: async (id: string) => {
    const prev = get().notes;
    set({
      notes: prev.filter((n) => n.id !== id),
      activeNoteId: get().activeNoteId === id ? null : get().activeNoteId,
    });
    try {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    } catch (e) {
      console.error("[noteStore] deleteNote failed:", e);
      set({ notes: prev });
    }
  },

  setActiveNote: (id: string | null) => set({ activeNoteId: id }),
}));
