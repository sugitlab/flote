import { create } from "zustand";
import type { Note } from "@flote/types";
import type { NoteRepository, NoteManifest } from "@flote/api-client";

const INITIAL_BODY_LIMIT = 100;

type NoteStore = {
  notes: Note[];
  activeNoteId: string | null;
  bodyLoadedIds: Set<string>;
  deletedIds: Set<string>;
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

function manifestToNote(m: NoteManifest): Note {
  return { id: m.id, title: m.title, pinned: m.pinned, note_type: m.note_type, body_md: "", updated_at: m.updated_at };
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  bodyLoadedIds: new Set<string>(),
  deletedIds: new Set<string>(),
  repo: null,

  initStore: (repo: NoteRepository) => {
    set({ repo });
  },

  fetchNotes: async (userId?: string) => {
    const { repo, notes: cached, bodyLoadedIds, deletedIds } = get();
    if (!repo) return;

    const manifest = await repo.getManifest(userId ?? "");
    const serverMap = new Map(manifest.map((m) => [m.id, m]));
    const localMap = new Map(cached.map((n) => [n.id, n]));

    // IDs that exist locally but were deleted on server
    const toDelete = new Set<string>();
    for (const id of localMap.keys()) {
      if (!serverMap.has(id) && !deletedIds.has(id)) toDelete.add(id);
    }

    // IDs that are new or have been updated on server since our local copy
    const toFetch: string[] = [];
    for (const [id, serverEntry] of serverMap) {
      const local = localMap.get(id);
      if (!local || local.updated_at < serverEntry.updated_at) {
        toFetch.push(id);
      }
    }

    // On initial load (empty cache), cap full-body fetch to avoid downloading everything.
    // Sort toFetch by server updated_at desc so we prioritise the most recent notes.
    const toFetchSorted = toFetch.slice().sort((a, b) => {
      const aAt = serverMap.get(a)?.updated_at ?? "";
      const bAt = serverMap.get(b)?.updated_at ?? "";
      return bAt.localeCompare(aAt);
    });
    const toFetchFull = toFetchSorted.slice(0, INITIAL_BODY_LIMIT);
    const toFetchMetaOnly = toFetchSorted.slice(INITIAL_BODY_LIMIT);

    const [fetched] = await Promise.all([
      repo.getNotesByIds(toFetchFull),
    ]);

    const fetchedMap = new Map(fetched.map((n) => [n.id, n]));

    // Build merged note list
    const next = new Map<string, Note>();

    // Keep unchanged local notes
    for (const [id, note] of localMap) {
      if (!toDelete.has(id)) next.set(id, note);
    }

    // Apply full fetches (with body_md)
    for (const note of fetched) {
      next.set(note.id, note);
    }

    // Apply metadata-only for notes beyond the body limit (manifests only)
    for (const id of toFetchMetaOnly) {
      const serverEntry = serverMap.get(id)!;
      const local = localMap.get(id);
      // Preserve body_md if we already had it loaded locally
      if (local && bodyLoadedIds.has(id)) {
        next.set(id, { ...local, ...serverEntry });
      } else {
        next.set(id, manifestToNote(serverEntry));
      }
    }

    // Update bodyLoadedIds
    const newBodyLoadedIds = new Set(bodyLoadedIds);
    for (const id of toDelete) newBodyLoadedIds.delete(id);
    for (const note of fetched) newBodyLoadedIds.add(note.id);

    set({ notes: [...next.values()], bodyLoadedIds: newBodyLoadedIds });
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
    void userId;
  },

  saveNote: async (note: Note, userId?: string) => {
    const { repo, deletedIds } = get();
    if (!repo) return;
    if (deletedIds.has(note.id)) return;
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
    const { repo, deletedIds } = get();
    if (!repo) return;
    const prev = get().notes;
    const nextDeletedIds = new Set([...deletedIds, id]);
    set({
      notes: prev.filter((n) => n.id !== id),
      activeNoteId: get().activeNoteId === id ? null : get().activeNoteId,
      deletedIds: nextDeletedIds,
    });

    try {
      await repo.deleteNote(id);
    } catch (e) {
      console.error("[noteStore] deleteNote failed:", e);
      set({ notes: prev, deletedIds });
      return;
    }
    setTimeout(() => {
      set((s) => {
        const d = new Set(s.deletedIds);
        d.delete(id);
        return { deletedIds: d };
      });
    }, 10_000);
  },

  deleteNotesBatch: async (ids: string[]) => {
    const { repo, deletedIds } = get();
    if (!repo) return;
    const prev = get().notes;
    const idSet = new Set(ids);
    const nextDeletedIds = new Set([...deletedIds, ...ids]);
    set({
      notes: prev.filter((n) => !idSet.has(n.id)),
      activeNoteId: idSet.has(get().activeNoteId ?? "") ? null : get().activeNoteId,
      deletedIds: nextDeletedIds,
    });

    try {
      await repo.deleteNotesBatch(ids);
    } catch (e) {
      console.error("[noteStore] deleteNotesBatch failed:", e);
      set({ notes: prev, deletedIds });
      return;
    }
    setTimeout(() => {
      set((s) => {
        const d = new Set(s.deletedIds);
        ids.forEach((id) => d.delete(id));
        return { deletedIds: d };
      });
    }, 10_000);
  },

  setActiveNote: (id: string | null) => set({ activeNoteId: id }),

  applyRemoteChange: (eventType, note) => {
    const { notes, deletedIds } = get();
    if (eventType !== "DELETE" && deletedIds.has(note.id)) return;
    switch (eventType) {
      case "INSERT":
        if (!notes.some((n) => n.id === note.id)) {
          set({ notes: [note, ...notes] });
        }
        break;
      case "UPDATE": {
        const local = notes.find((n) => n.id === note.id);
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
