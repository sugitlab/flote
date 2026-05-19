import type { Note } from "@flote/types";
import type { NoteRepository } from "../types";
import { getNotes, getNoteById, saveNote, deleteNote } from "../../sqlite-storage";

export class LocalNoteRepository implements NoteRepository {
  async getNotes(_userId: string): Promise<Note[]> {
    return getNotes();
  }

  async getNoteById(id: string): Promise<Note | null> {
    return getNoteById(id);
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
