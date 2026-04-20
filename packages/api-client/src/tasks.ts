import type { Task, TaskInsert, TaskUpdate } from "@flote/types";
import { getSupabase } from "./supabase";

export async function listTasks(userId?: string): Promise<Task[]> {
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

export async function createTask(task: TaskInsert, userId: string): Promise<Task> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: task.title,
      due_date: task.due_date,
      remind_at: task.remind_at,
      done: task.done,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return toTask(data);
}

export async function updateTask(id: string, task: TaskUpdate): Promise<Task> {
  const supabase = getSupabase();
  const patch: Record<string, unknown> = {};
  if (task.title !== undefined) patch.title = task.title;
  if (task.due_date !== undefined) patch.due_date = task.due_date;
  if (task.remind_at !== undefined) patch.remind_at = task.remind_at;
  if (task.done !== undefined) patch.done = task.done;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toTask(data);
}

export async function saveTask(task: Task, userId: string): Promise<Task> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .upsert({
      id: task.id,
      title: task.title,
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

export async function deleteTask(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleTask(id: string, done: boolean): Promise<Task> {
  return updateTask(id, { done });
}

function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    due_date: row.due_date as string | null,
    remind_at: row.remind_at as string | null,
    done: row.done as boolean,
    updated_at: row.updated_at as string,
  };
}
