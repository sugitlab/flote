import { create } from "zustand";
import type { Task, TaskStatus } from "@flote/types";
import { supabase } from "../lib/supabase";

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
const INITIAL_BODY_LIMIT = 100;

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

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  bodyLoadedIds: new Set<string>(),

  fetchTasks: async (userId: string) => {
    set({ loading: true });
    try {
      const { data: manifestData, error: manifestError } = await supabase
        .from("tasks")
        .select("id, title, due_date, status, done, pinned, updated_at")
        .eq("user_id", userId);
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

      const { tasks: cached, bodyLoadedIds } = get();
      const serverMap = new Map(manifest.map((m) => [m.id, m]));
      const localMap = new Map(cached.map((t) => [t.id, t]));

      const toDelete = new Set<string>();
      for (const id of localMap.keys()) {
        if (!serverMap.has(id)) toDelete.add(id);
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

      const fetched = await fetchTasksByIds(toFetchFull);
      const fetchedMap = new Map(fetched.map((t) => [t.id, t]));
      void fetchedMap;

      const next = new Map<string, Task>();

      for (const [id, task] of localMap) {
        if (!toDelete.has(id)) next.set(id, task);
      }
      for (const task of fetched) {
        next.set(task.id, task);
      }
      for (const id of toFetchMetaOnly) {
        const serverEntry = serverMap.get(id)!;
        const local = localMap.get(id);
        if (local && bodyLoadedIds.has(id)) {
          next.set(id, { ...local, ...manifestToTask(serverEntry) });
        } else {
          next.set(id, manifestToTask(serverEntry));
        }
      }

      const newBodyLoadedIds = new Set(bodyLoadedIds);
      for (const id of toDelete) newBodyLoadedIds.delete(id);
      for (const task of fetched) newBodyLoadedIds.add(task.id);

      set({ tasks: [...next.values()], bodyLoadedIds: newBodyLoadedIds });
    } catch (e) {
      console.error("[taskStore] fetchTasks failed:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  ensureBodyMd: async (id: string) => {
    const { bodyLoadedIds, tasks } = get();
    if (bodyLoadedIds.has(id)) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, body_md, due_date, status, done, pinned, updated_at")
      .eq("id", id)
      .single();
    if (error || !data) return;
    const full = toTask(data);
    set({
      tasks: tasks.map((t) => (t.id === id ? full : t)),
      bodyLoadedIds: new Set([...bodyLoadedIds, id]),
    });
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
}));
