import type { Note } from "@flote/types";
import type { NoteRepository } from "../types";
import { getSupabase } from "../../supabase";

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    body_md: (row.body_md as string) ?? "",
    updated_at: row.updated_at as string,
  };
}

export class SupabaseNoteRepository implements NoteRepository {
  async getNotes(userId?: string): Promise<Note[]> {
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

  async saveNote(note: Note, userId?: string): Promise<Note> {
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
