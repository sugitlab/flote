import { create } from "zustand";
import type { Task, TaskStatus } from "@flote/types";
import { supabase } from "../lib/supabase";
import { readJson, writeJson, readBodies, writeBody, removeBody } from "../lib/fsCache";
import { getSince, advanceCursor, fetchDeletions, type SyncCursor } from "../lib/deltaSync";

type TaskStore = {
  tasks: Task[];
  loading: boolean;
  bodyLoadedIds: Set<string>;
  fetchTasks: (userId: string) => Promise<void>;
  ensureBodyMd: (id: string) => Promise<void>;
  saveTask: (task: Task, userId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateStatus: (id: string, status: TaskStatus, userId: string) => Promise<void>;
};

type TaskManifest = { id: string; title: string; due_date: string | null; status: TaskStatus; pinned: boolean; updated_at: string };

type PersistedMeta = { tasks: Task[]; cursor: SyncCursor | null };

const META_FILE = "tasks-meta.json";
const BODY_PREFIX = "task-body-";

function toTask(row: Record<string, unknown>): Task {
  const status =
    (row.status as TaskStatus | undefined) ??
    (row.done ? "Done" : "Todo");
  return {
    id: row.id as string,
    title: row.title as string,
    body_md: (row.body_md as string) ?? "",
    due_date: row.due_date as string | null,
    status,
    pinned: row.pinned === true || row.pinned === 1,
    updated_at: row.updated_at as string,
  };
}

function manifestToTask(m: TaskManifest): Task {
  return { id: m.id, title: m.title, body_md: "", due_date: m.due_date, status: m.status, pinned: m.pinned, updated_at: m.updated_at };
}

const CHUNK_SIZE = 50;
const SERVER_BODY_FETCH_LIMIT = 100;

async function fetchTasksByIds(ids: string[]): Promise<Task[]> {
  if (ids.length === 0) return [];
  const results: Task[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, body_md, due_date, status, done, pinned, updated_at")
      .in("id", chunk);
    if (error) throw error;
    results.push(...(data ?? []).map(toTask));
  }
  return results;
}

let isSyncingTasks = false;

export const useTaskStore = create<TaskStore>((set, get) => {
  let cursor: SyncCursor | null = null;

  // Hydrate cached metadata from disk so the list renders instantly offline.
  const hydration = (async () => {
    const meta = await readJson<PersistedMeta>(META_FILE);
    if (meta) {
      cursor = meta.cursor ?? null;
      if (meta.tasks?.length && get().tasks.length === 0) {
        set({ tasks: meta.tasks });
      }
    }
  })();

  const persistMeta = (tasks: Task[]) => {
    void writeJson(META_FILE, {
      tasks: tasks.map((t) => ({ ...t, body_md: "" })),
      cursor,
    } satisfies PersistedMeta);
  };

  return {
    tasks: [],
    loading: false,
    bodyLoadedIds: new Set<string>(),

    fetchTasks: async (userId: string) => {
      if (isSyncingTasks) return;
      isSyncingTasks = true;
      set({ loading: true });
      try {
        await hydration;

        // Delta sync (same strategy as noteStore)
        let since = getSince(cursor, userId);
        let tombstones: string[] = [];
        if (since) {
          const d = await fetchDeletions(userId, since, "tasks");
          if (d === null) since = null;
          else tombstones = d;
        }
        const isFullSync = since === null;

        let manifestQuery = supabase
          .from("tasks")
          .select("id, title, due_date, status, done, pinned, updated_at")
          .eq("user_id", userId);
        if (since) manifestQuery = manifestQuery.gte("updated_at", since);
        const { data: manifestData, error: manifestError } = await manifestQuery;
        if (manifestError) throw manifestError;

        const manifest: TaskManifest[] = (manifestData ?? []).map((r) => {
          const status = (r.status as TaskStatus | undefined) ?? (r.done ? "Done" : "Todo");
          return {
            id: r.id as string,
            title: (r.title as string) ?? "",
            due_date: r.due_date as string | null,
            status,
            pinned: r.pinned === true,
            updated_at: r.updated_at as string,
          };
        });

        const { tasks: snapshot, bodyLoadedIds } = get();
        const serverMap = new Map(manifest.map((m) => [m.id, m]));
        const localMap = new Map(snapshot.map((t) => [t.id, t]));

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
        const fetched = await fetchTasksByIds(toFetchFull);
        const fetchedMap = new Map(fetched.map((t) => [t.id, t]));
        for (const t of fetched) {
          writeBody(BODY_PREFIX, t.id, { body_md: t.body_md, updated_at: t.updated_at });
        }

        const next = new Map<string, Task>();
        const newBodyLoadedIds = new Set(bodyLoadedIds);
        for (const id of toDelete) {
          newBodyLoadedIds.delete(id);
          removeBody(BODY_PREFIX, id);
        }

        for (const [id, task] of localMap) {
          if (!toDelete.has(id)) next.set(id, task);
        }
        for (const [id, serverEntry] of serverMap) {
          const local = localMap.get(id);
          const fetchedTask = fetchedMap.get(id);
          const cacheBody = hydrated.get(id);
          if (fetchedTask) {
            next.set(id, fetchedTask);
            newBodyLoadedIds.add(id);
          } else if (cacheBody !== undefined) {
            next.set(id, { ...manifestToTask(serverEntry), body_md: cacheBody });
            newBodyLoadedIds.add(id);
          } else if (local && local.updated_at >= serverEntry.updated_at) {
            next.set(id, local);
          } else {
            next.set(id, manifestToTask(serverEntry));
            newBodyLoadedIds.delete(id);
          }
        }
        for (const id of bodyMissing) {
          if (serverMap.has(id)) continue;
          const local = localMap.get(id);
          if (!local || toDelete.has(id)) continue;
          const fetchedTask = fetchedMap.get(id);
          const cacheBody = hydrated.get(id);
          if (fetchedTask) {
            next.set(id, fetchedTask);
            newBodyLoadedIds.add(id);
          } else if (cacheBody !== undefined) {
            next.set(id, { ...local, body_md: cacheBody });
            newBodyLoadedIds.add(id);
          }
        }

        cursor = advanceCursor(cursor, userId, manifest.map((m) => m.updated_at), isFullSync);
        const nextTasks = [...next.values()];
        set({ tasks: nextTasks, bodyLoadedIds: newBodyLoadedIds });
        persistMeta(nextTasks);
      } catch (e) {
        console.error("[taskStore] fetchTasks failed:", e);
        throw e;
      } finally {
        isSyncingTasks = false;
        set({ loading: false });
      }
    },

    ensureBodyMd: async (id: string) => {
      const { bodyLoadedIds, tasks } = get();
      if (bodyLoadedIds.has(id)) return;

      // File cache first — avoids a server round-trip when the revision matches
      const task = tasks.find((t) => t.id === id);
      if (task) {
        const entry = (await readBodies(BODY_PREFIX, [id])).get(id);
        if (entry && entry.updated_at === task.updated_at) {
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, body_md: entry.body_md } : t)),
            bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
          }));
          return;
        }
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, body_md, due_date, status, done, pinned, updated_at")
        .eq("id", id)
        .single();
      if (error || !data) return;
      const full = toTask(data);
      writeBody(BODY_PREFIX, id, { body_md: full.body_md, updated_at: full.updated_at });
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? full : t)),
        bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
      }));
    },

    saveTask: async (task: Task, userId: string) => {
      const prev = get().tasks;
      const exists = prev.some((t) => t.id === task.id);
      const optimistic = exists
        ? prev.map((t) => (t.id === task.id ? task : t))
        : [task, ...prev];
      set({ tasks: optimistic });

      try {
        const { error } = await supabase.from("tasks").upsert({
          id: task.id,
          title: task.title,
          body_md: task.body_md,
          due_date: task.due_date,
          status: task.status,
          done: task.status === "Done",
          updated_at: task.updated_at,
          user_id: userId,
        });
        if (error) throw error;
        writeBody(BODY_PREFIX, task.id, { body_md: task.body_md, updated_at: task.updated_at });
        set((s) => ({ bodyLoadedIds: new Set([...s.bodyLoadedIds, task.id]) }));
        persistMeta(get().tasks);
      } catch (e) {
        console.error("[taskStore] saveTask failed:", e);
        set({ tasks: prev });
        throw e;
      }
    },

    deleteTask: async (id: string) => {
      const prev = get().tasks;
      set({ tasks: prev.filter((t) => t.id !== id) });
      try {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) throw error;
        removeBody(BODY_PREFIX, id);
        persistMeta(get().tasks);
      } catch (e) {
        console.error("[taskStore] deleteTask failed:", e);
        set({ tasks: prev });
      }
    },

    updateStatus: async (id: string, status: TaskStatus, userId: string) => {
      const task = get().tasks.find((t) => t.id === id);
      if (!task) return;
      await get().saveTask({ ...task, status, updated_at: new Date().toISOString() }, userId);
    },
  };
});
