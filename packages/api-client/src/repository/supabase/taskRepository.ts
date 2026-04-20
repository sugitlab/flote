import type { Task } from "@flote/types";
import type { TaskRepository } from "../types";
import { getSupabase } from "../../supabase";

function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    body_md: (row.body_md as string) ?? "",
    due_date: row.due_date as string | null,
    remind_at: row.remind_at as string | null,
    done: row.done as boolean,
    updated_at: row.updated_at as string,
  };
}

export class SupabaseTaskRepository implements TaskRepository {
  async getTasks(userId?: string): Promise<Task[]> {
    const supabase = getSupabase();
    let query = supabase
      .from("tasks")
      .select("*")
      .order("updated_at", { ascending: false });
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toTask);
  }

  async saveTask(task: Task, userId?: string): Promise<Task> {
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
