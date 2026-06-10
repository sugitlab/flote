import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Task, TaskStatus } from "@flote/types";
import type { TaskRepository, TaskManifest } from "@flote/api-client";
import { useUIStore } from "./uiStore";
import { taskBodyCache } from "../lib/bodyCache";
import { getSince, advanceCursor } from "../lib/syncCursor";

const SYNC_CURSOR_KEY = "flote-sync-cursor-tasks";

// Max bodies fetched from the server per sync. Bodies beyond this limit stay
// metadata-only and are picked up by the next sync or by ensureBodyMd on open.
const SERVER_BODY_FETCH_LIMIT = 100;

let isSyncingTasks = false;
const pendingSaveTaskIds = new Set<string>();

type TaskStore = {
  tasks: Task[];
  activeTaskId: string | null;
  // IDs whose body_md in memory is the full, current content.
  // Only these tasks may be treated as "genuinely empty" by the auto-cleanup logic.
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
          const { repo, tasks: snapshot, bodyLoadedIds } = get();
          if (!repo) return;

          // Delta sync (same strategy as noteStore.fetchNotes): changed rows +
          // tombstones since the cursor; full sync as fallback / every 24h.
          let since = getSince(SYNC_CURSOR_KEY, userId ?? "");
          let tombstones: string[] = [];
          if (since) {
            const d = await repo.getDeletions(userId ?? "", since);
            if (d === null) since = null;
            else tombstones = d;
          }
          const isFullSync = since === null;

          const manifest = await repo.getManifest(userId ?? "", since ?? undefined);
          const serverMap = new Map(manifest.map((m) => [m.id, m]));
          const localMap = new Map(snapshot.map((t) => [t.id, t]));

          const toDelete = new Set<string>();
          if (isFullSync) {
            for (const id of localMap.keys()) {
              if (!serverMap.has(id) && !pendingSaveTaskIds.has(id)) toDelete.add(id);
            }
          } else {
            for (const id of tombstones) {
              if (!serverMap.has(id) && !pendingSaveTaskIds.has(id)) toDelete.add(id);
            }
          }

          // Changed revisions and missing bodies are resolved from IndexedDB
          // first; only cache misses hit the server.
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
          // In delta mode unchanged tasks are absent from the manifest, so the
          // body backfill must also scan local tasks directly.
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
          const cacheEntries = await taskBodyCache.get(candidates);
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
          const fetched = await repo.getTasksByIds(toFetchFull);
          const fetchedMap = new Map(fetched.map((t) => [t.id, t]));
          void taskBodyCache.put(
            fetched.map((t) => ({ id: t.id, body_md: t.body_md, updated_at: t.updated_at }))
          );

          const next = new Map<string, Task>();
          const newBodyLoadedIds = new Set(bodyLoadedIds);
          for (const id of toDelete) newBodyLoadedIds.delete(id);

          // Base: current local tasks minus deletions
          for (const [id, task] of localMap) {
            if (!toDelete.has(id)) next.set(id, task);
          }
          // Overlay: server changes with resolved bodies
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
          // Body backfill for unchanged local tasks (delta mode)
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

          void taskBodyCache.delete([...toDelete]);

          // Sync succeeded — advance the delta cursor
          advanceCursor(
            SYNC_CURSOR_KEY,
            userId ?? "",
            manifest.map((m) => m.updated_at),
            isFullSync
          );

          // In-flight saves always win over fetched data.
          set((s) => {
            for (const id of pendingSaveTaskIds) {
              const pending = s.tasks.find((t) => t.id === id);
              if (pending) next.set(id, pending);
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

        // Cache first — avoids a server round-trip when the revision matches
        const task = tasks.find((t) => t.id === id);
        if (task) {
          const entry = (await taskBodyCache.get([id])).get(id);
          if (entry && entry.updated_at === task.updated_at) {
            set((s) => ({
              tasks: s.tasks.map((t) => (t.id === id ? { ...t, body_md: entry.body_md } : t)),
              bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
            }));
            return;
          }
        }

        const full = await repo.getTaskById(id);
        if (!full) return;
        void taskBodyCache.put([{ id: full.id, body_md: full.body_md, updated_at: full.updated_at }]);
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? full : t)),
          bodyLoadedIds: new Set([...s.bodyLoadedIds, id]),
        }));
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
          void taskBodyCache.put([{ id: saved.id, body_md: saved.body_md, updated_at: saved.updated_at }]);
          // Always upsert after save — a concurrent fetchTasks may have removed the task
          set((s) => {
            const present = s.tasks.some((t) => t.id === saved.id);
            return {
              tasks: present
                ? s.tasks.map((t) => (t.id === saved.id ? saved : t))
                : [saved, ...s.tasks],
              // A body we just saved is by definition fully known
              bodyLoadedIds: new Set([...s.bodyLoadedIds, saved.id]),
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
          void taskBodyCache.delete([id]);
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
          void taskBodyCache.delete(ids);
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
        // Realtime payloads can omit large columns — an empty body_md may mean
        // "truncated", not "cleared". Never overwrite a local body with an
        // empty remote one; mark stale so ensureBodyMd re-fetches the truth.
        const bodyUsable = task.body_md !== "";
        switch (eventType) {
          case "INSERT":
            if (!tasks.some((t) => t.id === task.id)) {
              set((s) => ({
                tasks: [task, ...s.tasks],
                bodyLoadedIds: bodyUsable ? new Set([...s.bodyLoadedIds, task.id]) : s.bodyLoadedIds,
              }));
              if (bodyUsable) void taskBodyCache.put([{ id: task.id, body_md: task.body_md, updated_at: task.updated_at }]);
            }
            break;
          case "UPDATE": {
            const local = tasks.find((t) => t.id === task.id);
            if (local && local.updated_at >= task.updated_at) break;
            const merged = !bodyUsable && local && local.body_md
              ? { ...task, body_md: local.body_md }
              : task;
            set((s) => {
              const loaded = new Set(s.bodyLoadedIds);
              if (bodyUsable) loaded.add(task.id);
              else loaded.delete(task.id);
              return {
                tasks: s.tasks.map((t) => (t.id === task.id ? merged : t)),
                bodyLoadedIds: loaded,
              };
            });
            if (bodyUsable) void taskBodyCache.put([{ id: task.id, body_md: task.body_md, updated_at: task.updated_at }]);
            break;
          }
          case "DELETE":
            set((s) => {
              const loaded = new Set(s.bodyLoadedIds);
              loaded.delete(task.id);
              return {
                tasks: s.tasks.filter((t) => t.id !== task.id),
                activeTaskId: s.activeTaskId === task.id ? null : s.activeTaskId,
                bodyLoadedIds: loaded,
              };
            });
            void taskBodyCache.delete([task.id]);
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
