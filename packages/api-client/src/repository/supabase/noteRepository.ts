import type { Note } from "@flote/types";
import type { NoteRepository } from "../types";
import { getSupabase } from "../../supabase";

function toNote(row: Record<string, unknown>): Note {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body_md: String(row.body_md ?? ""),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export class SupabaseNoteRepository implements NoteRepository {
  async getNotes(userId: string): Promise<Note[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toNote);
  }

  async saveNote(note: Note, userId: string): Promise<Note> {
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

  async deleteNote(id: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
  }
}
