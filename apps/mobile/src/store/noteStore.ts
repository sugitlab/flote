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

type NoteManifest = { id: string; title: string; pinned: boolean; note_type: Note["note_type"]; updated_at: string };

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    body_md: (row.body_md as string) ?? "",
    pinned: row.pinned === true || row.pinned === 1,
    note_type: (row.note_type as Note["note_type"]) ?? "markdown",
    updated_at: row.updated_at as string,
  };
}

function manifestToNote(m: NoteManifest): Note {
  return { id: m.id, title: m.title, pinned: m.pinned, note_type: m.note_type, body_md: "", updated_at: m.updated_at };
}

const CHUNK_SIZE = 50;
const INITIAL_BODY_LIMIT = 100;

async function fetchNotesByIds(ids: string[]): Promise<Note[]> {
  if (ids.length === 0) return [];
  const results: Note[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, body_md, pinned, note_type, updated_at")
      .in("id", chunk);
    if (error) throw error;
    results.push(...(data ?? []).map(toNote));
  }
  return results;
}

let isSyncingNotes = false;

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  loading: false,
  activeNoteId: null,
  bodyLoadedIds: new Set<string>(),

  fetchNotes: async (userId: string) => {
    if (isSyncingNotes) return;
    isSyncingNotes = true;
    set({ loading: true });
    try {
      // Fetch lightweight manifest — no body_md
      const { data: manifestData, error: manifestError } = await supabase
        .from("notes")
        .select("id, title, pinned, note_type, updated_at")
        .eq("user_id", userId);
      if (manifestError) throw manifestError;

      const manifest: NoteManifest[] = (manifestData ?? []).map((r) => ({
        id: r.id as string,
        title: (r.title as string) ?? "",
        pinned: r.pinned === true,
        note_type: ((r.note_type as string) ?? "markdown") as Note["note_type"],
        updated_at: r.updated_at as string,
      }));

      const { notes: cached, bodyLoadedIds } = get();
      const serverMap = new Map(manifest.map((m) => [m.id, m]));
      const localMap = new Map(cached.map((n) => [n.id, n]));

      // Detect server-side deletions
      const toDelete = new Set<string>();
      for (const id of localMap.keys()) {
        if (!serverMap.has(id)) toDelete.add(id);
      }

      // Detect new or updated notes
      const toFetch: string[] = [];
      for (const [id, serverEntry] of serverMap) {
        const local = localMap.get(id);
        if (!local || local.updated_at < serverEntry.updated_at) {
          toFetch.push(id);
        }
      }

      // Sort by most recently updated; cap full-body fetch to INITIAL_BODY_LIMIT
      const toFetchSorted = toFetch.slice().sort((a, b) => {
        const aAt = serverMap.get(a)?.updated_at ?? "";
        const bAt = serverMap.get(b)?.updated_at ?? "";
        return bAt.localeCompare(aAt);
      });
      const toFetchFull = toFetchSorted.slice(0, INITIAL_BODY_LIMIT);
      const toFetchMetaOnly = toFetchSorted.slice(INITIAL_BODY_LIMIT);

      const fetched = await fetchNotesByIds(toFetchFull);
      const fetchedMap = new Map(fetched.map((n) => [n.id, n]));

      const next = new Map<string, Note>();

      for (const [id, note] of localMap) {
        if (!toDelete.has(id)) next.set(id, note);
      }
      for (const note of fetched) {
        next.set(note.id, note);
      }
      for (const id of toFetchMetaOnly) {
        const serverEntry = serverMap.get(id)!;
        const local = localMap.get(id);
        if (local && bodyLoadedIds.has(id)) {
          next.set(id, { ...local, ...manifestToNote(serverEntry) });
        } else {
          next.set(id, manifestToNote(serverEntry));
        }
      }

      const newBodyLoadedIds = new Set(bodyLoadedIds);
      for (const id of toDelete) newBodyLoadedIds.delete(id);
      for (const note of fetched) newBodyLoadedIds.add(note.id);

      set({ notes: [...next.values()], bodyLoadedIds: newBodyLoadedIds });
    } catch (e) {
      console.error("[noteStore] fetchNotes failed:", e);
      throw e;
    } finally {
      isSyncingNotes = false;
      set({ loading: false });
    }
  },

  ensureBodyMd: async (id: string) => {
    const { bodyLoadedIds, notes } = get();
    if (bodyLoadedIds.has(id)) return;
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, body_md, pinned, note_type, updated_at")
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
