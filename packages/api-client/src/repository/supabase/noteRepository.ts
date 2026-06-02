import type { Note } from "@flote/types";
import type { NoteRepository } from "../types";
import { getSupabase } from "../../supabase";

function toNote(row: Record<string, unknown>): Note {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    body_md: String(row.body_md ?? ""),
    pinned: row.pinned === true || row.pinned === 1,
    note_type: (row.note_type as Note["note_type"]) ?? "markdown",
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
        .select("id, title, body_md, pinned, note_type, updated_at")
        .eq("user_id", userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(BODY_FETCH_LIMIT),
      supabase
        .from("notes")
        .select("id, title, pinned, note_type, updated_at")
        .eq("user_id", userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .range(BODY_FETCH_LIMIT, 1_000_000),
    ]);

    // If note_type column is missing (migration not yet applied), fall back to queries without it
    // PostgREST: PGRST204 = column not found in schema cache; PG: 42703 = undefined_column
    const columnMissing =
      fullRes.error &&
      ((fullRes.error.code === "PGRST204") ||
        (fullRes.error.code === "42703") ||
        (fullRes.error.message ?? "").toLowerCase().includes("note_type") ||
        (fullRes.error.message ?? "").toLowerCase().includes("schema cache"));
    if (columnMissing) {
      const [fullFallback, minimalFallback] = await Promise.all([
        supabase
          .from("notes")
          .select("id, title, body_md, pinned, updated_at")
          .eq("user_id", userId)
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(BODY_FETCH_LIMIT),
        supabase
          .from("notes")
          .select("id, title, pinned, updated_at")
          .eq("user_id", userId)
          .order("pinned", { ascending: false })
          .order("updated_at", { ascending: false })
          .range(BODY_FETCH_LIMIT, 1_000_000),
      ]);
      if (fullFallback.error) throw fullFallback.error;
      if (minimalFallback.error) throw minimalFallback.error;
      const full = (fullFallback.data ?? []).map((r) => toNote({ ...r, note_type: "markdown" }));
      const minimal = (minimalFallback.data ?? []).map((r) => toNote({ ...r, note_type: "markdown", body_md: "" }));
      return [...full, ...minimal];
    }

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
      .select("id, title, body_md, pinned, note_type, updated_at")
      .eq("id", id)
      .single();
    if (error) return null;
    return toNote(data);
  }

  async saveNote(note: Note, userId: string): Promise<Note> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("notes")
      .upsert({
        id: note.id,
        title: note.title,
        body_md: note.body_md,
        pinned: note.pinned,
        note_type: note.note_type ?? "markdown",
        updated_at: note.updated_at,
        user_id: userId,
      });
    if (error) throw error;
    return note;
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
