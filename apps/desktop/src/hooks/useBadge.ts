import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTaskStore } from "../store/taskStore";

function countOverdueTasks(tasks: { due_date: string | null; done: boolean }[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter((t) => !t.done && t.due_date && t.due_date <= today).length;
}

export function useBadge() {
  const tasks = useTaskStore((s) => s.tasks);
  const prevCount = useRef<number>(-1);

  useEffect(() => {
    const count = countOverdueTasks(tasks);
    if (count !== prevCount.current) {
      prevCount.current = count;
      invoke("update_tray_badge", { count }).catch(() => {
        // Ignore errors (e.g. during development without Tauri)
      });
    }
  }, [tasks]);
}
