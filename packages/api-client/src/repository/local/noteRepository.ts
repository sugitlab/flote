import type { Note } from "@flote/types";
import type { NoteRepository, NoteManifest } from "../types";
import { getNotes, getNoteById, saveNote, deleteNote } from "../../sqlite-storage";

export class LocalNoteRepository implements NoteRepository {
  async getNotes(_userId: string): Promise<Note[]> {
    return getNotes();
  }

  async getNoteById(id: string): Promise<Note | null> {
    return getNoteById(id);
  }

  async getManifest(_userId: string, _since?: string): Promise<NoteManifest[]> {
    // Local SQLite is cheap to scan — always return the full manifest
    const notes = await getNotes();
    return notes.map((n) => ({
      id: n.id,
      title: n.title,
      pinned: n.pinned,
      note_type: n.note_type,
      updated_at: n.updated_at,
    }));
  }

  async getDeletions(_userId: string, _since: string): Promise<string[] | null> {
    // No tombstones locally — signal "unsupported" so the store uses full sync
    return null;
  }

  async getNotesByIds(ids: string[]): Promise<Note[]> {
    const results: Note[] = [];
    for (const id of ids) {
      const note = await getNoteById(id);
      if (note) results.push(note);
    }
    return results;
  }

  async saveNote(note: Note, _userId: string): Promise<Note> {
    await saveNote(note);
    return note;
  }

  async deleteNote(id: string): Promise<void> {
    await deleteNote(id);
  }

  async deleteNotesBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await deleteNote(id);
    }
  }
}
