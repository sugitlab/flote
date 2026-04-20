import type { Note, NoteInsert, NoteUpdate } from "@flote/types";
import { getSupabase } from "./supabase";

export async function listNotes(userId?: string): Promise<Note[]> {
  const supabase = getSupabase();
  let query = supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (userId) {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toNote);
}

export async function getNote(id: string): Promise<Note | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? toNote(data) : null;
}

export async function createNote(note: NoteInsert, userId: string): Promise<Note> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: note.title, body_md: note.body_md, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

export async function updateNote(id: string, note: NoteUpdate): Promise<Note> {
  const supabase = getSupabase();
  const patch: Record<string, unknown> = {};
  if (note.title !== undefined) patch.title = note.title;
  if (note.body_md !== undefined) patch.body_md = note.body_md;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("notes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

export async function saveNote(note: Note, userId: string): Promise<Note> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notes")
    .upsert({
      id: note.id,
      title: note.title,
      body_md: note.body_md,
      updated_at: note.updated_at,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    body_md: (row.body_md as string) ?? "",
    updated_at: row.updated_at as string,
  };
}
