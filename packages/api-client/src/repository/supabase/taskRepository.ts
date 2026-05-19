import type { Task } from "@flote/types";
import type { TaskRepository } from "../types";
import { getSupabase } from "../../supabase";

function toTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body_md: String(row.body_md ?? ""),
    due_date: row.due_date != null ? String(row.due_date) : null,
    done: Boolean(row.done),
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
    return [...full, ...minimal];
  }

  async getTaskById(id: string): Promise<Task | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, body_md, due_date, done, updated_at")
      .eq("id", id)
      .single();
    if (error) return null;
    return toTask(data);
  }

  async saveTask(task: Task, userId: string): Promise<Task> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tasks")
      .upsert({
        id: task.id,
        title: task.title,
        body_md: task.body_md,
        due_date: task.due_date,
        done: task.done,
        updated_at: task.updated_at,
        user_id: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return toTask(data);
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

  async toggleDone(id: string, done: boolean): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("tasks")
      .update({ done, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
