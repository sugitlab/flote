import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTaskStore } from "../store/taskStore";
import { useT } from "./useT";

function countOverdueTasks(tasks: { due_date: string | null; status: string }[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter((t) => t.status !== "Done" && t.due_date && t.due_date <= today).length;
}

export function useBadge() {
  const tasks = useTaskStore((s) => s.tasks);
  const t = useT();
  const prevCount = useRef<number>(-1);

  useEffect(() => {
    const count = countOverdueTasks(tasks);
    if (count !== prevCount.current) {
      prevCount.current = count;
      const overdueTooltip = count > 0 ? t.tray.overdueTooltip(count) : undefined;
      invoke("update_tray_badge", { count, overdueTooltip }).catch(() => {
        // Ignore errors (e.g. during development without Tauri)
      });
    }
  }, [tasks, t]);
}
