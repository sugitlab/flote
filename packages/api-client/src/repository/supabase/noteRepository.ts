import type { Note } from "@flote/types";
import type { NoteRepository, NoteManifest } from "../types";
import { getSupabase } from "../../supabase";

const CHUNK_SIZE = 50;
const BODY_FETCH_LIMIT = 100;
const FILES_BUCKET = "note-files";
// Upload files to Storage when their JSON exceeds this size (bytes).
// Below this threshold they stay embedded in body_md.
const FILES_STORAGE_THRESHOLD = 50_000;

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

function filesStoragePath(userId: string, noteId: string): string {
  return `${userId}/${noteId}.json`;
}

function hasStorageRef(body_md: string): boolean {
  try { return !!JSON.parse(body_md)?.files?.__ref; } catch { return false; }
}

async function uploadFiles(userId: string, noteId: string, files: Record<string, unknown>): Promise<string> {
  const supabase = getSupabase();
  const path = filesStoragePath(userId, noteId);
  const blob = new Blob([JSON.stringify(files)], { type: "application/json" });
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw error;
  return path;
}

async function downloadFiles(path: string): Promise<Record<string, unknown>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage.from(FILES_BUCKET).download(path);
  if (error) throw error;
  return JSON.parse(await data.text());
}

async function resolveStorageRef(note: Note): Promise<Note> {
  if (note.note_type !== "excalidraw") return note;
  try {
    const parsed = JSON.parse(note.body_md);
    const ref = parsed?.files?.__ref as string | undefined;
    if (!ref) return note;
    const files = await downloadFiles(ref);
    return { ...note, body_md: JSON.stringify({ ...parsed, files }) };
  } catch {
    return note;
  }
}

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

  async getManifest(userId: string): Promise<NoteManifest[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, pinned, note_type, updated_at")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      pinned: r.pinned === true,
      note_type: (r.note_type as Note["note_type"]) ?? "markdown",
      updated_at: String(r.updated_at ?? ""),
    }));
  }

  async getNotesByIds(ids: string[]): Promise<Note[]> {
    if (ids.length === 0) return [];
    const supabase = getSupabase();
    const results: Note[] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, body_md, pinned, note_type, updated_at")
        .in("id", chunk);
      if (error) throw error;
      results.push(...(data ?? []).map(toNote));
    }
    return results;
    // Note: storage refs (__ref) are intentionally not resolved here.
    // They are resolved lazily in getNoteById (called via ensureBodyMd when a note is opened).
  }

  async getNoteById(id: string): Promise<Note | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("notes")
      .select("id, title, body_md, pinned, note_type, updated_at")
      .eq("id", id)
      .single();
    if (error) return null;
    const note = toNote(data);
    // Resolve storage ref if files were offloaded to Supabase Storage
    return resolveStorageRef(note);
  }

  async saveNote(note: Note, userId: string): Promise<Note> {
    const supabase = getSupabase();
    let body_md = note.body_md;

    if (note.note_type === "excalidraw") {
      try {
        const parsed = JSON.parse(body_md);
        const files = (parsed.files ?? {}) as Record<string, unknown>;
        const filesJson = JSON.stringify(files);
        const hasFiles = Object.keys(files).length > 0 && !files.__ref;
        if (hasFiles && filesJson.length > FILES_STORAGE_THRESHOLD) {
          const path = await uploadFiles(userId, note.id, files);
          parsed.files = { __ref: path };
          body_md = JSON.stringify(parsed);
        }
      } catch {
        // Parsing failed — save body_md as-is
      }
    }

    const { error } = await supabase
      .from("notes")
      .upsert({
        id: note.id,
        title: note.title,
        body_md,
        pinned: note.pinned,
        note_type: note.note_type ?? "markdown",
        updated_at: note.updated_at,
        user_id: userId,
      });
    if (error) throw error;
    // Return the note with the (possibly slimmed) body_md so the store stays consistent
    return { ...note, body_md };
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

