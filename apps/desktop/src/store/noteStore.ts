import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Note } from "@flote/types";
import type { NoteRepository, NoteManifest } from "@flote/api-client";
import { useUIStore } from "./uiStore";
import { noteBodyCache } from "../lib/bodyCache";

function hasStorageRef(body_md: string): boolean {
  try { return !!JSON.parse(body_md)?.files?.__ref; } catch { return false; }
}

// Max bodies fetched from the server per sync. Bodies beyond this limit stay
// metadata-only and are picked up by the next sync or by ensureBodyMd on open.
const SERVER_BODY_FETCH_LIMIT = 100;

// Module-level flag: prevents concurrent fetchNotes calls from running in parallel
let isSyncingNotes = false;
// Tracks IDs currently being saved so fetchNotes doesn't delete them before save completes
const pendingSaveNoteIds = new Set<string>();

type NoteStore = {
  notes: Note[];
  activeNoteId: string | null;
  // IDs whose body_md in memory is the full, current content (inline, no storage ref).
  // Only these notes may be treated as "genuinely empty" by the auto-cleanup logic.
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
          const { repo, notes: snapshot, bodyLoadedIds, deletedIds } = get();
          if (!repo) return;

          const manifest = await repo.getManifest(userId ?? "");
          const serverMap = new Map(manifest.map((m) => [m.id, m]));
          const localMap = new Map(snapshot.map((n) => [n.id, n]));

          const toDelete = new Set<string>();
          for (const id of localMap.keys()) {
            if (!serverMap.has(id) && !deletedIds.has(id) && !pendingSaveNoteIds.has(id)) toDelete.add(id);
          }

          // Classify every server note:
          //  - changed: server has a newer revision than local → body must be re-resolved
          //  - bodyMissing: revision unchanged but body is not in memory (stripped by
          //    partialize on restart, or beyond a previous fetch limit)
          //  - otherwise: local copy is current → keep as-is
          const changed: string[] = [];
          const bodyMissing: string[] = [];
          for (const [id, serverEntry] of serverMap) {
            const local = localMap.get(id);
            if (!local || local.updated_at < serverEntry.updated_at) {
              changed.push(id);
            } else if (!local.body_md && !bodyLoadedIds.has(id)) {
              bodyMissing.push(id);
            }
          }
          const byUpdatedAtDesc = (a: string, b: string) =>
            (serverMap.get(b)?.updated_at ?? "").localeCompare(serverMap.get(a)?.updated_at ?? "");
          changed.sort(byUpdatedAtDesc);
          bodyMissing.sort(byUpdatedAtDesc);

          // Resolve bodies from IndexedDB first; only cache misses hit the server.
          // A cache entry is valid only when its updated_at matches the manifest exactly.
          const candidates = [...changed, ...bodyMissing];
          const cacheEntries = await noteBodyCache.get(candidates);
          const hydrated = new Map<string, string>();
          const needServer: string[] = [];
          for (const id of candidates) {
            const entry = cacheEntries.get(id);
            const serverEntry = serverMap.get(id)!;
            if (entry && entry.updated_at === serverEntry.updated_at && !hasStorageRef(entry.body_md)) {
              hydrated.set(id, entry.body_md);
            } else {
              needServer.push(id);
            }
          }

          const toFetchFull = needServer.slice(0, SERVER_BODY_FETCH_LIMIT);
          const fetched = await repo.getNotesByIds(toFetchFull);
          const fetchedMap = new Map(fetched.map((n) => [n.id, n]));
          void noteBodyCache.put(
            fetched
              .filter((n) => !hasStorageRef(n.body_md))
              .map((n) => ({ id: n.id, body_md: n.body_md, updated_at: n.updated_at }))
          );

          const next = new Map<string, Note>();
          const newBodyLoadedIds = new Set(bodyLoadedIds);
          for (const id of toDelete) newBodyLoadedIds.delete(id);

          for (const [id, serverEntry] of serverMap) {
            const local = localMap.get(id);
            const fetchedNote = fetchedMap.get(id);
            const cacheBody = hydrated.get(id);
            if (fetchedNote) {
              next.set(id, fetchedNote);
              if (hasStorageRef(fetchedNote.body_md)) newBodyLoadedIds.delete(id);
              else newBodyLoadedIds.add(id);
            } else if (cacheBody !== undefined) {
              next.set(id, { ...manifestToNote(serverEntry), body_md: cacheBody });
              newBodyLoadedIds.add(id);
            } else if (local && local.updated_at >= serverEntry.updated_at) {
              next.set(id, local);
            } else {
              // changed but beyond the fetch limit (or the fetch missed it):
              // metadata only, body resolved later — must NOT count as loaded
              next.set(id, manifestToNote(serverEntry));
              newBodyLoadedIds.delete(id);
            }
          }
          // Keep local-only notes that are still being created on the server
          for (const [id, note] of localMap) {
            if (!serverMap.has(id) && !toDelete.has(id)) next.set(id, note);
          }

          void noteBodyCache.delete([...toDelete]);

          // Use functional set so we can read the live state: in-flight saves
          // always win over fetched data (their content is newer than both the
          // snapshot taken above and whatever the server returned).
          set((s) => {
            for (const id of pendingSaveNoteIds) {
              const pending = s.notes.find((n) => n.id === id);
              if (pending) next.set(id, pending);
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

        // Cache first — avoids a server round-trip when the revision matches
        if (note) {
          const entry = (await noteBodyCache.get([id])).get(id);
          if (entry && entry.updated_at === note.updated_at && !hasStorageRef(entry.body_md)) {
            set((s) => ({
              notes: s.notes.map((n) => (n.id === id ? { ...n, body_md: entry.body_md } : n)),
              bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
            }));
            return;
          }
        }

        const full = await repo.getNoteById(id);
        if (!full) return;
        // After resolving storage ref, mark as loaded only if files are now inline
        const isFullyResolved = !hasStorageRef(full.body_md);
        if (isFullyResolved) void noteBodyCache.put([{ id: full.id, body_md: full.body_md, updated_at: full.updated_at }]);
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
          // Cache the inline body: if the repo offloaded files to Storage,
          // `note.body_md` still holds the full inline content we just saved.
          const inlineBody = hasStorageRef(saved.body_md) ? note.body_md : saved.body_md;
          if (!hasStorageRef(inlineBody)) {
            void noteBodyCache.put([{ id: saved.id, body_md: inlineBody, updated_at: saved.updated_at }]);
          }
          // Always upsert after save — a concurrent fetchNotes may have removed the note
          set((s) => {
            if (s.deletedIds.has(saved.id)) return {};
            const present = s.notes.some((n) => n.id === saved.id);
            return {
              notes: present
                ? s.notes.map((n) => (n.id === saved.id ? saved : n))
                : [saved, ...s.notes],
              // A body we just saved is by definition fully known
              bodyLoadedIds: hasStorageRef(saved.body_md)
                ? s.bodyLoadedIds
                : new Set([...s.bodyLoadedIds, saved.id]),
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
          void noteBodyCache.delete([id]);
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
          void noteBodyCache.delete(ids);
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
        // Realtime payloads can omit large columns (~1MB limit), so an empty
        // body_md may mean "truncated", not "cleared". Never overwrite a local
        // body with an empty remote one — keep the local body and mark it
        // stale so ensureBodyMd re-fetches the truth on next open.
        const bodyUsable = note.body_md !== "" && !hasStorageRef(note.body_md);
        switch (eventType) {
          case "INSERT":
            if (!notes.some((n) => n.id === note.id)) {
              set((s) => ({
                notes: [note, ...s.notes],
                bodyLoadedIds: bodyUsable ? new Set([...s.bodyLoadedIds, note.id]) : s.bodyLoadedIds,
              }));
              if (bodyUsable) void noteBodyCache.put([{ id: note.id, body_md: note.body_md, updated_at: note.updated_at }]);
            }
            break;
          case "UPDATE": {
            const local = notes.find((n) => n.id === note.id);
            if (local && local.updated_at >= note.updated_at) break;
            const merged = !bodyUsable && local && local.body_md
              ? { ...note, body_md: local.body_md }
              : note;
            set((s) => {
              const loaded = new Set(s.bodyLoadedIds);
              if (bodyUsable) loaded.add(note.id);
              else loaded.delete(note.id);
              return {
                notes: s.notes.map((n) => (n.id === note.id ? merged : n)),
                bodyLoadedIds: loaded,
              };
            });
            if (bodyUsable) void noteBodyCache.put([{ id: note.id, body_md: note.body_md, updated_at: note.updated_at }]);
            break;
          }
          case "DELETE":
            set((s) => {
              const loaded = new Set(s.bodyLoadedIds);
              loaded.delete(note.id);
              return {
                notes: s.notes.filter((n) => n.id !== note.id),
                activeNoteId: s.activeNoteId === note.id ? null : s.activeNoteId,
                bodyLoadedIds: loaded,
              };
            });
            void noteBodyCache.delete([note.id]);
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
      // Bodies are cached in IndexedDB (bodyCache.ts) and re-hydrated on startup.
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
