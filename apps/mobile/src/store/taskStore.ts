import { create } from "zustand";
import type { Task } from "@flote/types";
import { supabase } from "../lib/supabase";

type TaskStore = {
  tasks: Task[];
  loading: boolean;
  bodyLoadedIds: Set<string>;
  fetchTasks: (userId: string) => Promise<void>;
  ensureBodyMd: (id: string) => Promise<void>;
  saveTask: (task: Task, userId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleDone: (id: string, userId: string) => Promise<void>;
};

function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    body_md: (row.body_md as string) ?? "",
    due_date: row.due_date as string | null,
    done: row.done as boolean,
    updated_at: row.updated_at as string,
  };
}

const BODY_FETCH_LIMIT = 100;

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  bodyLoadedIds: new Set<string>(),

  fetchTasks: async (userId: string) => {
    set({ loading: true });
    try {
      const [fullRes, minimalRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, body_md, due_date, done, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(BODY_FETCH_LIMIT),
        supabase
          .from("tasks")
          .select("id, title, due_date, done, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .range(BODY_FETCH_LIMIT, 1_000_000),
      ]);
      if (fullRes.error) throw fullRes.error;
      if (minimalRes.error) throw minimalRes.error;
      const full = (fullRes.data ?? []).map(toTask);
      const minimal = (minimalRes.data ?? []).map((r) => toTask({ ...r, body_md: "" }));
      const tasks = [...full, ...minimal];
      const loaded = new Set(full.map((t) => t.id));
      set({ tasks, bodyLoadedIds: loaded });
    } finally {
      set({ loading: false });
    }
  },

  ensureBodyMd: async (id: string) => {
    const { bodyLoadedIds, tasks } = get();
    if (bodyLoadedIds.has(id)) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, body_md, due_date, done, updated_at")
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
        done: task.done,
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

  toggleDone: async (id: string, userId: string) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const updated: Task = {
      ...task,
      done: !task.done,
      updated_at: new Date().toISOString(),
    };
    await get().saveTask(updated, userId);
  },
}));
