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

const BODY_FETCH_LIMIT = 100;

export class SupabaseNoteRepository implements NoteRepository {
  async getNotes(userId: string): Promise<Note[]> {
    const supabase = getSupabase();
    const [fullRes, minimalRes] = await Promise.all([
      supabase
        .from("notes")
        .select("id, title, body_md, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(BODY_FETCH_LIMIT),
      supabase
        .from("notes")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .range(BODY_FETCH_LIMIT, 1_000_000),
    ]);
    if (fullRes.error) throw fullRes.error;
    if (minimalRes.error) throw minimalRes.error;
    const full = (fullRes.data ?? []).map(toNote);
    const minimal = (minimalRes.data ?? []).map((r) => toNote({ ...r, body_md: "" }));
    return [...full, ...minimal];
  }

  async getNoteById(id: string): Promise<Note | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, body_md, updated_at")
      .eq("id", id)
      .single();
    if (error) return null;
    return toNote(data);
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

  async deleteNotesBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const supabase = getSupabase();
    const { error } = await supabase.from("notes").delete().in("id", ids);
    if (error) throw error;
  }
}
