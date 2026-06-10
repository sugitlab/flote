import type { Note } from "@flote/types";
import type { NoteRepository, NoteManifest } from "../types";
import { getSupabase } from "../../supabase";
import { isColumnMissingError } from "./errors";

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

function svgStoragePath(userId: string, noteId: string): string {
  return `${userId}/${noteId}.svg`;
}

function hasStorageRef(body_md: string): boolean {
  try { return !!JSON.parse(body_md)?.files?.__ref; } catch { return false; }
}

// Cheap content digest so repeated saves skip re-uploading unchanged blobs.
function digest(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}
// `${noteId}:files` / `${noteId}:svg` → digest of last successful upload
const lastUploadedDigests = new Map<string, string>();

async function uploadToBucket(path: string, content: string, contentType: string): Promise<void> {
  const supabase = getSupabase();
  const blob = new Blob([content], { type: contentType });
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
  });
  if (error) throw error;
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

    if (isColumnMissingError(fullRes.error)) {
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

  async getManifest(userId: string, since?: string): Promise<NoteManifest[]> {
    const supabase = getSupabase();
    let query = supabase
      .from("notes")
      .select("id, title, pinned, note_type, updated_at")
      .eq("user_id", userId);
    if (since) query = query.gte("updated_at", since);
    const { data, error } = await query;
    if (error) {
      if (!isColumnMissingError(error)) throw error;
      // Fallback: pinned / note_type columns may not exist yet (migration not applied)
      let q2 = supabase.from("notes").select("id, title, updated_at").eq("user_id", userId);
      if (since) q2 = q2.gte("updated_at", since);
      const { data: data2, error: e2 } = await q2;
      if (e2) throw e2;
      return (data2 ?? []).map((r) => ({
        id: String(r.id ?? ""),
        title: String(r.title ?? ""),
        pinned: false,
        note_type: "markdown" as Note["note_type"],
        updated_at: String(r.updated_at ?? ""),
      }));
    }
    return (data ?? []).map((r) => ({
      id: String(r.id ?? ""),
      title: String(r.title ?? ""),
      pinned: r.pinned === true,
      note_type: (r.note_type as Note["note_type"]) ?? "markdown",
      updated_at: String(r.updated_at ?? ""),
    }));
  }

  async getDeletions(userId: string, since: string): Promise<string[] | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("deletions")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "notes")
      .gte("deleted_at", since);
    // Table missing (migration not applied) — caller must fall back to full sync
    if (error) return null;
    return (data ?? []).map((r) => String(r.id));
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
      if (error) {
        if (!isColumnMissingError(error)) throw error;
        // Fallback: pinned / note_type columns may not exist yet
        const { data: data2, error: e2 } = await supabase
          .from("notes")
          .select("id, title, body_md, updated_at")
          .in("id", chunk);
        if (e2) throw e2;
        results.push(...(data2 ?? []).map((r) => toNote({ ...r, pinned: false, note_type: "markdown" })));
        continue;
      }
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
        let mutated = false;

        // Offload the SVG preview to Storage. Keeping it inline duplicates the
        // elements data and roughly doubles the row size written on every save.
        const svg = typeof parsed.svg === "string" ? parsed.svg : "";
        if (svg) {
          const svgPath = svgStoragePath(userId, note.id);
          const svgKey = `${note.id}:svg`;
          const svgDigest = digest(svg);
          if (lastUploadedDigests.get(svgKey) !== svgDigest) {
            await uploadToBucket(svgPath, svg, "image/svg+xml");
            lastUploadedDigests.set(svgKey, svgDigest);
          }
          parsed.svg = "";
          parsed.svg_ref = svgPath;
          mutated = true;
        }

        // Offload embedded image files to Storage when large. Skip the upload
        // entirely when the files blob hasn't changed since the last save.
        const files = (parsed.files ?? {}) as Record<string, unknown>;
        const hasFiles = Object.keys(files).length > 0 && !files.__ref;
        if (hasFiles) {
          const filesJson = JSON.stringify(files);
          if (filesJson.length > FILES_STORAGE_THRESHOLD) {
            const path = filesStoragePath(userId, note.id);
            const filesKey = `${note.id}:files`;
            const filesDigest = digest(filesJson);
            if (lastUploadedDigests.get(filesKey) !== filesDigest) {
              await uploadToBucket(path, filesJson, "application/json");
              lastUploadedDigests.set(filesKey, filesDigest);
            }
            parsed.files = { __ref: path };
            mutated = true;
          }
        }

        if (mutated) body_md = JSON.stringify(parsed);
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
    if (error) {
      if (!isColumnMissingError(error)) throw error;
      // Fallback: pinned / note_type columns may not exist yet (migration not applied)
      const { error: e2 } = await supabase
        .from("notes")
        .upsert({
          id: note.id,
          title: note.title,
          body_md,
          updated_at: note.updated_at,
          user_id: userId,
        });
      if (e2) throw e2;
    }
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
