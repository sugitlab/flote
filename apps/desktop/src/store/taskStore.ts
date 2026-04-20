import { create } from "zustand";
import type { Task } from "@flote/types";
import type { TaskRepository } from "@flote/api-client";

type TaskStore = {
  tasks: Task[];
  activeTaskId: string | null;
  repo: TaskRepository | null;
  initStore: (repo: TaskRepository) => void;
  fetchTasks: (userId?: string) => Promise<void>;
  saveTask: (task: Task, userId?: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
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
  repo: null,

  initStore: (repo: TaskRepository) => {
    set({ repo });
  },

  fetchTasks: async (userId?: string) => {
    const { repo } = get();
    if (!repo) return;
    const tasks = await repo.getTasks(userId);
    set({ tasks });
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
      await repo.saveTask(task, userId);
    } catch {
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
    } catch {
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
      case "UPDATE":
        set({
          tasks: tasks.map((t) => (t.id === task.id ? task : t)),
        });
        break;
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
