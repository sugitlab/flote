import type { Note, NoteInsert, NoteUpdate } from "@flote/types";
import { getClient } from "./client";

export async function listNotes(): Promise<Note[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNote);
}

export async function getNote(id: string): Promise<Note | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data ? toNote(data) : null;
}

export async function createNote(note: NoteInsert): Promise<Note> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({ title: note.title, body_md: note.body_md })
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

export async function updateNote(id: string, note: NoteUpdate): Promise<Note> {
  const supabase = getClient();
  const patch: Record<string, unknown> = {};
  if (note.title !== undefined) patch.title = note.title;
  if (note.body_md !== undefined) patch.body_md = note.body_md;
  const { data, error } = await supabase
    .from("notes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toNote(data);
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = getClient();
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
