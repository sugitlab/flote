import type { Task } from "@flote/types";
import type { TaskRepository } from "../types";
import { getSupabase } from "../../supabase";

function toTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body_md: String(row.body_md ?? ""),
    due_date: row.due_date != null ? String(row.due_date) : null,
    remind_at: row.remind_at != null ? String(row.remind_at) : null,
    done: Boolean(row.done),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export class SupabaseTaskRepository implements TaskRepository {
  async getTasks(userId: string): Promise<Task[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toTask);
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
        remind_at: task.remind_at,
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

  async toggleDone(id: string, done: boolean): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("tasks")
      .update({ done, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }
}
