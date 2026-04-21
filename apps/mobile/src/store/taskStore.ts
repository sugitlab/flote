import { create } from "zustand";
import type { Task } from "@flote/types";
import { supabase } from "../lib/supabase";

type TaskStore = {
  tasks: Task[];
  loading: boolean;
  fetchTasks: (userId: string) => Promise<void>;
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

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (userId: string) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      set({ tasks: (data ?? []).map(toTask) });
    } finally {
      set({ loading: false });
    }
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
