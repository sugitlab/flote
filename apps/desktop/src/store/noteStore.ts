import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Note } from "@flote/types";
import type { NoteRepository, NoteManifest } from "@flote/api-client";
import { useUIStore } from "./uiStore";

function hasStorageRef(body_md: string): boolean {
  try { return !!JSON.parse(body_md)?.files?.__ref; } catch { return false; }
}

const INITIAL_BODY_LIMIT = 100;

// Module-level flag: prevents concurrent fetchNotes calls from running in parallel
let isSyncingNotes = false;
// Tracks IDs currently being saved so fetchNotes doesn't delete them before save completes
const pendingSaveNoteIds = new Set<string>();

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

export const useNoteStore = create<NoteStore>()(
  persist(
    (set, get) => ({
      notes: [],
      activeNoteId: null,
      bodyLoadedIds: new Set<string>(),
      deletedIds: new Set<string>(),
      repo: null,

      initStore: (repo: NoteRepository) => {
        set({ repo });
      },

      fetchNotes: async (userId?: string) => {
        if (isSyncingNotes) return;
        isSyncingNotes = true;
        try {
          const { repo, notes: cached, bodyLoadedIds, deletedIds } = get();
          if (!repo) return;

          const manifest = await repo.getManifest(userId ?? "");
          const serverMap = new Map(manifest.map((m) => [m.id, m]));
          const localMap = new Map(cached.map((n) => [n.id, n]));

          const toDelete = new Set<string>();
          for (const id of localMap.keys()) {
            if (!serverMap.has(id) && !deletedIds.has(id) && !pendingSaveNoteIds.has(id)) toDelete.add(id);
          }

          const toFetch: string[] = [];
          for (const [id, serverEntry] of serverMap) {
            const local = localMap.get(id);
            if (!local || local.updated_at < serverEntry.updated_at) {
              toFetch.push(id);
            }
          }

          const toFetchSorted = toFetch.slice().sort((a, b) => {
            const aAt = serverMap.get(a)?.updated_at ?? "";
            const bAt = serverMap.get(b)?.updated_at ?? "";
            return bAt.localeCompare(aAt);
          });
          const toFetchFull = toFetchSorted.slice(0, INITIAL_BODY_LIMIT);
          const toFetchMetaOnly = toFetchSorted.slice(INITIAL_BODY_LIMIT);

          const fetched = await repo.getNotesByIds(toFetchFull);
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
            if (local && bodyLoadedIds.has(id) && !hasStorageRef(local.body_md)) {
              next.set(id, { ...local, ...manifestToNote(serverEntry) });
            } else {
              next.set(id, manifestToNote(serverEntry));
            }
          }

          const newBodyLoadedIds = new Set(bodyLoadedIds);
          for (const id of toDelete) newBodyLoadedIds.delete(id);
          for (const note of fetched) {
            if (!hasStorageRef(note.body_md)) newBodyLoadedIds.add(note.id);
          }

          // Use functional set so we can read the live state and re-add any
          // notes that were optimistically inserted by saveNote *after* we took
          // the `cached` snapshot at the top of this function.
          set((s) => {
            for (const id of pendingSaveNoteIds) {
              if (!next.has(id)) {
                const pending = s.notes.find((n) => n.id === id);
                if (pending) next.set(id, pending);
              }
            }
            return { notes: [...next.values()], bodyLoadedIds: newBodyLoadedIds };
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[noteStore] fetchNotes failed:", e);
          useUIStore.getState().addToast("error", `ノート同期エラー: ${msg}`);
        } finally {
          isSyncingNotes = false;
        }
      },

      ensureBodyMd: async (id: string, userId?: string) => {
        const { repo, bodyLoadedIds, notes } = get();
        if (!repo) return;
        const note = notes.find((n) => n.id === id);
        // Re-fetch if not yet loaded, or if files were offloaded to Storage (needs resolution)
        const needsResolution = note?.note_type === "excalidraw" && hasStorageRef(note.body_md);
        if (!needsResolution && bodyLoadedIds.has(id)) return;
        const full = await repo.getNoteById(id);
        if (!full) return;
        // After resolving storage ref, mark as loaded only if files are now inline
        const isFullyResolved = !hasStorageRef(full.body_md);
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? full : n)),
          bodyLoadedIds: isFullyResolved
            ? new Set([...s.bodyLoadedIds, id])
            : s.bodyLoadedIds,
        }));
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

        pendingSaveNoteIds.add(note.id);
        try {
          const saved = await repo.saveNote(note, userId ?? "");
          // Always upsert after save — a concurrent fetchNotes may have removed the note
          set((s) => {
            if (s.deletedIds.has(saved.id)) return {};
            const present = s.notes.some((n) => n.id === saved.id);
            return {
              notes: present
                ? s.notes.map((n) => (n.id === saved.id ? saved : n))
                : [saved, ...s.notes],
            };
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[noteStore] saveNote failed:", e);
          useUIStore.getState().addToast("error", `ノート保存エラー: ${msg}`);
          set({ notes: prev });
        } finally {
          pendingSaveNoteIds.delete(note.id);
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
          set((s) => { const d = new Set(s.deletedIds); d.delete(id); return { deletedIds: d }; });
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
          set((s) => { const d = new Set(s.deletedIds); ids.forEach((id) => d.delete(id)); return { deletedIds: d }; });
        }, 10_000);
      },

      setActiveNote: (id: string | null) => set({ activeNoteId: id }),

      applyRemoteChange: (eventType, note) => {
        const { notes, deletedIds } = get();
        if (eventType !== "DELETE" && deletedIds.has(note.id)) return;
        switch (eventType) {
          case "INSERT":
            if (!notes.some((n) => n.id === note.id)) set({ notes: [note, ...notes] });
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
              activeNoteId: get().activeNoteId === note.id ? null : get().activeNoteId,
            });
            break;
        }
      },
    }),
    {
      name: "flote-notes-v2",
      storage: createJSONStorage(() => localStorage),
      // Persist note metadata only — body_md is intentionally excluded.
      // body_md can be megabytes (especially Excalidraw SVG/base64 data) and would
      // quickly exhaust the ~10 MB WebKit localStorage quota.
      // Bodies are re-fetched from the server on startup via fetchNotes/ensureBodyMd.
      partialize: (state) => ({
        notes: state.notes.map((n) => ({ ...n, body_md: "" })),
      }),
      merge: (persisted, current) => {
        const p = persisted as { notes?: Note[] };
        return {
          ...current,
          notes: p.notes ?? [],
          bodyLoadedIds: new Set<string>(),
        };
      },
      version: 2,
    }
  )
);
