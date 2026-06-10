import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Task, TaskStatus } from "@flote/types";
import type { TaskRepository, TaskManifest } from "@flote/api-client";
import { useUIStore } from "./uiStore";

const INITIAL_BODY_LIMIT = 30;

let isSyncingTasks = false;
const pendingSaveTaskIds = new Set<string>();

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
  updateStatus: (id: string, status: TaskStatus, userId?: string) => Promise<void>;
  togglePin: (id: string, userId?: string) => Promise<void>;
  setActiveTask: (id: string | null) => void;
  applyRemoteChange: (
    eventType: "INSERT" | "UPDATE" | "DELETE",
    task: Task
  ) => void;
};

function manifestToTask(m: TaskManifest): Task {
  return {
    id: m.id,
    title: m.title,
    body_md: "",
    due_date: m.due_date,
    status: m.status as TaskStatus,
    pinned: m.pinned,
    updated_at: m.updated_at,
  };
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,
      bodyLoadedIds: new Set<string>(),
      repo: null,

      initStore: (repo: TaskRepository) => {
        set({ repo });
      },

      fetchTasks: async (userId?: string) => {
        if (isSyncingTasks) return;
        isSyncingTasks = true;
        try {
          const { repo, tasks: cached, bodyLoadedIds } = get();
          if (!repo) return;

          const manifest = await repo.getManifest(userId ?? "");
          const serverMap = new Map(manifest.map((m) => [m.id, m]));
          const localMap = new Map(cached.map((t) => [t.id, t]));

          const toDelete = new Set<string>();
          for (const id of localMap.keys()) {
            if (!serverMap.has(id) && !pendingSaveTaskIds.has(id)) toDelete.add(id);
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

          const fetched = await repo.getTasksByIds(toFetchFull);

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
              next.set(id, { ...manifestToTask(serverEntry), body_md: local.body_md });
            } else {
              next.set(id, manifestToTask(serverEntry));
            }
          }

          const newBodyLoadedIds = new Set(bodyLoadedIds);
          for (const id of toDelete) newBodyLoadedIds.delete(id);
          for (const task of fetched) newBodyLoadedIds.add(task.id);

          set((s) => {
            for (const id of pendingSaveTaskIds) {
              if (!next.has(id)) {
                const pending = s.tasks.find((t) => t.id === id);
                if (pending) next.set(id, pending);
              }
            }
            return { tasks: [...next.values()], bodyLoadedIds: newBodyLoadedIds };
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[taskStore] fetchTasks failed:", e);
          useUIStore.getState().addToast("error", `タスク同期エラー: ${msg}`);
        } finally {
          isSyncingTasks = false;
        }
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
        pendingSaveTaskIds.add(task.id);
        try {
          const saved = await repo.saveTask(task, userId ?? "");
          // Always upsert after save — a concurrent fetchTasks may have removed the task
          set((s) => {
            const present = s.tasks.some((t) => t.id === saved.id);
            return {
              tasks: present
                ? s.tasks.map((t) => (t.id === saved.id ? saved : t))
                : [saved, ...s.tasks],
            };
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[taskStore] saveTask failed:", e);
          useUIStore.getState().addToast("error", `タスク保存エラー: ${msg}`);
          set({ tasks: prev });
        } finally {
          pendingSaveTaskIds.delete(task.id);
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

      updateStatus: async (id: string, status: TaskStatus, userId?: string) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        await get().saveTask({ ...task, status, updated_at: new Date().toISOString() }, userId);
      },

      togglePin: async (id: string, userId?: string) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        await get().saveTask({ ...task, pinned: !task.pinned }, userId);
      },

      setActiveTask: (id: string | null) => set({ activeTaskId: id }),

      applyRemoteChange: (eventType, task) => {
        const { tasks } = get();
        switch (eventType) {
          case "INSERT":
            if (!tasks.some((t) => t.id === task.id)) set({ tasks: [task, ...tasks] });
            break;
          case "UPDATE": {
            const local = tasks.find((t) => t.id === task.id);
            if (local && local.updated_at >= task.updated_at) break;
            set({ tasks: tasks.map((t) => (t.id === task.id ? task : t)) });
            break;
          }
          case "DELETE":
            set({
              tasks: tasks.filter((t) => t.id !== task.id),
              activeTaskId: get().activeTaskId === task.id ? null : get().activeTaskId,
            });
            break;
        }
      },
    }),
    {
      name: "flote-tasks-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks.map((t) => ({ ...t, body_md: "" })),
      }),
      merge: (persisted, current) => {
        const p = persisted as { tasks?: Task[] };
        return {
          ...current,
          tasks: p.tasks ?? [],
          bodyLoadedIds: new Set<string>(),
        };
      },
      version: 2,
    }
  )
);
