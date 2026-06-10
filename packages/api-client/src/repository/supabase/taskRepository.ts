import type { Task, TaskStatus } from "@flote/types";
import type { TaskRepository, TaskManifest } from "../types";
import { getSupabase } from "../../supabase";
import { isColumnMissingError } from "./errors";

const CHUNK_SIZE = 50;

// Explicit column list — `select("*")` would also pull remind_at / created_at /
// user_id etc. on every body fetch for no benefit.
const TASK_COLUMNS = "id, title, body_md, due_date, status, done, pinned, updated_at";

function toTask(row: Record<string, unknown>): Task {
  const status =
    (row.status as TaskStatus | undefined) ??
    (row.done ? "Done" : "Todo");
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body_md: String(row.body_md ?? ""),
    due_date: row.due_date != null ? String(row.due_date) : null,
    status,
    pinned: row.pinned === true || row.pinned === 1,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

const BODY_FETCH_LIMIT = 100;

export class SupabaseTaskRepository implements TaskRepository {
  async getTasks(userId: string): Promise<Task[]> {
    const supabase = getSupabase();
    const [fullRes, minimalRes] = await Promise.all([
      supabase
        .from("tasks")
        .select(TASK_COLUMNS)
        .eq("user_id", userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(BODY_FETCH_LIMIT),
      supabase
        .from("tasks")
        .select("id, title, due_date, done, pinned, updated_at")
        .eq("user_id", userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .range(BODY_FETCH_LIMIT, 1_000_000),
    ]);
    if (fullRes.error) throw fullRes.error;
    if (minimalRes.error) throw minimalRes.error;
    const full = (fullRes.data ?? []).map(toTask);
    const minimal = (minimalRes.data ?? []).map((r) => toTask({ ...r, body_md: "" }));
    return [...full, ...minimal];
  }

  async getManifest(userId: string, since?: string): Promise<TaskManifest[]> {
    const supabase = getSupabase();
    let query = supabase
      .from("tasks")
      .select("id, title, due_date, status, done, pinned, updated_at")
      .eq("user_id", userId);
    if (since) query = query.gte("updated_at", since);
    const { data, error } = await query;
    if (error) {
      if (!isColumnMissingError(error)) throw error;
      // Fallback: status / pinned columns may not exist yet (migration not applied)
      let q2 = supabase
        .from("tasks")
        .select("id, title, due_date, done, updated_at")
        .eq("user_id", userId);
      if (since) q2 = q2.gte("updated_at", since);
      const { data: data2, error: e2 } = await q2;
      if (e2) throw e2;
      return (data2 ?? []).map((r) => ({
        id: String(r.id ?? ""),
        title: String(r.title ?? ""),
        due_date: r.due_date != null ? String(r.due_date) : null,
        status: (r.done ? "Done" : "Todo") as string,
        pinned: false,
        updated_at: String(r.updated_at ?? ""),
      }));
    }
    return (data ?? []).map((r) => ({
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      due_date: r.due_date != null ? String(r.due_date) : null,
      status: String((r.status as string | undefined) ?? (r.done ? "Done" : "Todo")),
      pinned: r.pinned === true,
      updated_at: String(r.updated_at ?? ""),
    }));
  }

  async getDeletions(userId: string, since: string): Promise<string[] | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("deletions")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "tasks")
      .gte("deleted_at", since);
    // Table missing (migration not applied) — caller must fall back to full sync
    if (error) return null;
    return (data ?? []).map((r) => String(r.id));
  }

  async getTasksByIds(ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    const supabase = getSupabase();
    const results: Task[] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from("tasks")
        .select(TASK_COLUMNS)
        .in("id", chunk);
      if (error) {
        if (!isColumnMissingError(error)) throw error;
        // Fallback: some columns (pinned, status) may not exist yet
        const { data: data2, error: e2 } = await supabase
          .from("tasks")
          .select("id, title, body_md, due_date, done, updated_at")
          .in("id", chunk);
        if (e2) throw e2;
        results.push(...(data2 ?? []).map((r) => toTask({ ...r, pinned: false, status: undefined })));
        continue;
      }
      results.push(...(data ?? []).map(toTask));
    }
    return results;
  }

  async getTaskById(id: string): Promise<Task | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("id", id)
      .single();
    if (error) return null;
    return toTask(data);
  }

  async saveTask(task: Task, userId: string): Promise<Task> {
    const supabase = getSupabase();
    // Try with all columns first
    const { error } = await supabase.from("tasks").upsert({
      id: task.id,
      title: task.title,
      body_md: task.body_md,
      due_date: task.due_date,
      status: task.status,
      done: task.status === "Done",
      pinned: task.pinned,
      updated_at: task.updated_at,
      user_id: userId,
    });
    if (error) {
      if (!isColumnMissingError(error)) throw error;
      // Fallback 1: status column may not exist yet — retry without it (but keep pinned)
      const { error: e2 } = await supabase.from("tasks").upsert({
        id: task.id,
        title: task.title,
        body_md: task.body_md,
        due_date: task.due_date,
        done: task.status === "Done",
        pinned: task.pinned,
        updated_at: task.updated_at,
        user_id: userId,
      });
      if (e2) {
        if (!isColumnMissingError(e2)) throw e2;
        // Fallback 2: pinned column also missing — retry with minimal payload
        const { error: e3 } = await supabase.from("tasks").upsert({
          id: task.id,
          title: task.title,
          body_md: task.body_md,
          due_date: task.due_date,
          done: task.status === "Done",
          updated_at: task.updated_at,
          user_id: userId,
        });
        if (e3) throw e3;
      }
    }
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  }

  async deleteTasksBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const supabase = getSupabase();
    const { error } = await supabase.from("tasks").delete().in("id", ids);
    if (error) throw error;
  }
}
