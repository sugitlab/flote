import { create } from "zustand";
import type { Task } from "@flote/types";
import type { TaskRepository } from "@flote/api-client";

type TaskStore = {
  tasks: Task[];
  activeTaskId: string | null;
  bodyLoadedIds: Set<string>;
  repo: TaskRepository | null;
  initStore: (repo: TaskRepository) => void;
  fetchTasks: (userId?: string) => Promise<void>;
  ensureBodyMd: (id: string, userId?: string) => Promise<void>;
  saveTask: (task: Task, userId?: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteTasksBatch: (ids: string[]) => Promise<void>;
  toggleDone: (id: string, userId?: string) => Promise<void>;
  setActiveTask: (id: string | null) => void;
  applyRemoteChange: (
    eventType: "INSERT" | "UPDATE" | "DELETE",
    task: Task
  ) => void;
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  bodyLoadedIds: new Set<string>(),
  repo: null,

  initStore: (repo: TaskRepository) => {
    set({ repo });
  },

  fetchTasks: async (userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const tasks = await repo.getTasks(userId ?? "");
    const loaded = new Set(tasks.slice(0, 100).map((t) => t.id));
    set({ tasks, bodyLoadedIds: loaded });
  },

  ensureBodyMd: async (id: string, userId?: string) => {
    const { repo, bodyLoadedIds, tasks } = get();
    if (!repo || bodyLoadedIds.has(id)) return;
    const full = await repo.getTaskById(id);
    if (!full) return;
    set({
      tasks: tasks.map((t) => (t.id === id ? full : t)),
      bodyLoadedIds: new Set([...bodyLoadedIds, id]),
    });
    void userId;
  },

  saveTask: async (task: Task, userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().tasks;
    const exists = prev.some((t) => t.id === task.id);
    const optimistic = exists
      ? prev.map((t) => (t.id === task.id ? task : t))
      : [task, ...prev];
    set({ tasks: optimistic });

    try {
      await repo.saveTask(task, userId ?? "");
    } catch (e) {
      console.error("[taskStore] saveTask failed:", e);
      set({ tasks: prev });
    }
  },

  deleteTask: async (id: string) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().tasks;
    set({
      tasks: prev.filter((t) => t.id !== id),
      activeTaskId: get().activeTaskId === id ? null : get().activeTaskId,
    });

    try {
      await repo.deleteTask(id);
    } catch (e) {
      console.error("[taskStore] deleteTask failed:", e);
      set({ tasks: prev });
    }
  },

  deleteTasksBatch: async (ids: string[]) => {
    const { repo } = get();
    if (!repo) return;
    const prev = get().tasks;
    const idSet = new Set(ids);
    set({
      tasks: prev.filter((t) => !idSet.has(t.id)),
      activeTaskId: idSet.has(get().activeTaskId ?? "") ? null : get().activeTaskId,
    });

    try {
      await repo.deleteTasksBatch(ids);
    } catch (e) {
      console.error("[taskStore] deleteTasksBatch failed:", e);
      set({ tasks: prev });
    }
  },

  toggleDone: async (id: string, userId?: string) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const updated: Task = {
      ...task,
      done: !task.done,
      updated_at: new Date().toISOString(),
    };
    await get().saveTask(updated, userId);
  },

  setActiveTask: (id: string | null) => set({ activeTaskId: id }),

  applyRemoteChange: (eventType, task) => {
    const { tasks } = get();
    switch (eventType) {
      case "INSERT":
        if (!tasks.some((t) => t.id === task.id)) {
          set({ tasks: [task, ...tasks] });
        }
        break;
      case "UPDATE": {
        const local = tasks.find((t) => t.id === task.id);
        // Skip if local version is already newer or equal (own echo / stale update)
        if (local && local.updated_at >= task.updated_at) break;
        set({ tasks: tasks.map((t) => (t.id === task.id ? task : t)) });
        break;
      }
      case "DELETE":
        set({
          tasks: tasks.filter((t) => t.id !== task.id),
          activeTaskId:
            get().activeTaskId === task.id ? null : get().activeTaskId,
        });
        break;
    }
  },
}));
