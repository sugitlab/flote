import { create } from "zustand";
import type { Note } from "@flote/types";
import { supabase } from "../lib/supabase";
import { readJson, writeJson, readBodies, writeBody, removeBody } from "../lib/fsCache";
import { getSince, advanceCursor, fetchDeletions, type SyncCursor } from "../lib/deltaSync";

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

type PersistedMeta = { notes: Note[]; cursor: SyncCursor | null };

const META_FILE = "notes-meta.json";
const BODY_PREFIX = "note-body-";

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
const SERVER_BODY_FETCH_LIMIT = 100;

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

export const useNoteStore = create<NoteStore>((set, get) => {
  let cursor: SyncCursor | null = null;

  // Hydrate cached metadata from disk so the list renders instantly offline.
  const hydration = (async () => {
    const meta = await readJson<PersistedMeta>(META_FILE);
    if (meta) {
      cursor = meta.cursor ?? null;
      if (meta.notes?.length && get().notes.length === 0) {
        set({ notes: meta.notes });
      }
    }
  })();

  const persistMeta = (notes: Note[]) => {
    void writeJson(META_FILE, {
      notes: notes.map((n) => ({ ...n, body_md: "" })),
      cursor,
    } satisfies PersistedMeta);
  };

  return {
    notes: [],
    loading: false,
    activeNoteId: null,
    bodyLoadedIds: new Set<string>(),

    fetchNotes: async (userId: string) => {
      if (isSyncingNotes) return;
      isSyncingNotes = true;
      set({ loading: true });
      try {
        await hydration;

        // Delta sync: only rows changed since the cursor + tombstones.
        // Falls back to a full sync when no cursor / unsupported / every 24h.
        let since = getSince(cursor, userId);
        let tombstones: string[] = [];
        if (since) {
          const d = await fetchDeletions(userId, since, "notes");
          if (d === null) since = null;
          else tombstones = d;
        }
        const isFullSync = since === null;

        let manifestQuery = supabase
          .from("notes")
          .select("id, title, pinned, note_type, updated_at")
          .eq("user_id", userId);
        if (since) manifestQuery = manifestQuery.gte("updated_at", since);
        const { data: manifestData, error: manifestError } = await manifestQuery;
        if (manifestError) throw manifestError;

        const manifest: NoteManifest[] = (manifestData ?? []).map((r) => ({
          id: r.id as string,
          title: (r.title as string) ?? "",
          pinned: r.pinned === true,
          note_type: ((r.note_type as string) ?? "markdown") as Note["note_type"],
          updated_at: r.updated_at as string,
        }));

        const { notes: snapshot, bodyLoadedIds } = get();
        const serverMap = new Map(manifest.map((m) => [m.id, m]));
        const localMap = new Map(snapshot.map((n) => [n.id, n]));

        const toDelete = new Set<string>();
        if (isFullSync) {
          for (const id of localMap.keys()) {
            if (!serverMap.has(id)) toDelete.add(id);
          }
        } else {
          for (const id of tombstones) {
            if (!serverMap.has(id)) toDelete.add(id);
          }
        }

        // Bodies to resolve: changed revisions + locally missing bodies
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
        if (!isFullSync) {
          for (const [id, local] of localMap) {
            if (serverMap.has(id) || toDelete.has(id)) continue;
            if (!local.body_md && !bodyLoadedIds.has(id)) bodyMissing.push(id);
          }
        }
        const expectedRev = (id: string) =>
          serverMap.get(id)?.updated_at ?? localMap.get(id)?.updated_at ?? "";
        const byUpdatedAtDesc = (a: string, b: string) =>
          expectedRev(b).localeCompare(expectedRev(a));
        changed.sort(byUpdatedAtDesc);
        bodyMissing.sort(byUpdatedAtDesc);

        // File cache first; only misses hit the server
        const candidates = [...changed, ...bodyMissing];
        const cacheEntries = await readBodies(BODY_PREFIX, candidates);
        const hydrated = new Map<string, string>();
        const needServer: string[] = [];
        for (const id of candidates) {
          const entry = cacheEntries.get(id);
          if (entry && entry.updated_at === expectedRev(id)) {
            hydrated.set(id, entry.body_md);
          } else {
            needServer.push(id);
          }
        }

        const toFetchFull = needServer.slice(0, SERVER_BODY_FETCH_LIMIT);
        const fetched = await fetchNotesByIds(toFetchFull);
        const fetchedMap = new Map(fetched.map((n) => [n.id, n]));
        for (const n of fetched) {
          writeBody(BODY_PREFIX, n.id, { body_md: n.body_md, updated_at: n.updated_at });
        }

        const next = new Map<string, Note>();
        const newBodyLoadedIds = new Set(bodyLoadedIds);
        for (const id of toDelete) {
          newBodyLoadedIds.delete(id);
          removeBody(BODY_PREFIX, id);
        }

        for (const [id, note] of localMap) {
          if (!toDelete.has(id)) next.set(id, note);
        }
        for (const [id, serverEntry] of serverMap) {
          const local = localMap.get(id);
          const fetchedNote = fetchedMap.get(id);
          const cacheBody = hydrated.get(id);
          if (fetchedNote) {
            next.set(id, fetchedNote);
            newBodyLoadedIds.add(id);
          } else if (cacheBody !== undefined) {
            next.set(id, { ...manifestToNote(serverEntry), body_md: cacheBody });
            newBodyLoadedIds.add(id);
          } else if (local && local.updated_at >= serverEntry.updated_at) {
            next.set(id, local);
          } else {
            next.set(id, manifestToNote(serverEntry));
            newBodyLoadedIds.delete(id);
          }
        }
        for (const id of bodyMissing) {
          if (serverMap.has(id)) continue;
          const local = localMap.get(id);
          if (!local || toDelete.has(id)) continue;
          const fetchedNote = fetchedMap.get(id);
          const cacheBody = hydrated.get(id);
          if (fetchedNote) {
            next.set(id, fetchedNote);
            newBodyLoadedIds.add(id);
          } else if (cacheBody !== undefined) {
            next.set(id, { ...local, body_md: cacheBody });
            newBodyLoadedIds.add(id);
          }
        }

        cursor = advanceCursor(cursor, userId, manifest.map((m) => m.updated_at), isFullSync);
        const nextNotes = [...next.values()];
        set({ notes: nextNotes, bodyLoadedIds: newBodyLoadedIds });
        persistMeta(nextNotes);
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

      // File cache first — avoids a server round-trip when the revision matches
      const note = notes.find((n) => n.id === id);
      if (note) {
        const entry = (await readBodies(BODY_PREFIX, [id])).get(id);
        if (entry && entry.updated_at === note.updated_at) {
          set((s) => ({
            notes: s.notes.map((n) => (n.id === id ? { ...n, body_md: entry.body_md } : n)),
            bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
          }));
          return;
        }
      }

      const { data, error } = await supabase
        .from("notes")
        .select("id, title, body_md, pinned, note_type, updated_at")
        .eq("id", id)
        .single();
      if (error || !data) return;
      const full = toNote(data);
      writeBody(BODY_PREFIX, id, { body_md: full.body_md, updated_at: full.updated_at });
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? full : n)),
        bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
      }));
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
        writeBody(BODY_PREFIX, note.id, { body_md: note.body_md, updated_at: note.updated_at });
        set((s) => ({ bodyLoadedIds: new Set([...s.bodyLoadedIds, note.id]) }));
        persistMeta(get().notes);
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
        removeBody(BODY_PREFIX, id);
        persistMeta(get().notes);
      } catch (e) {
        console.error("[noteStore] deleteNote failed:", e);
        set({ notes: prev });
      }
    },

    setActiveNote: (id: string | null) => set({ activeNoteId: id }),
  };
});
