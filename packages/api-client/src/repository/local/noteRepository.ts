import type { Note } from "@flote/types";
import type { NoteRepository } from "../types";
import { getNotes, saveNote, deleteNote } from "../../sqlite-storage";

export class LocalNoteRepository implements NoteRepository {
  async getNotes(_userId: string): Promise<Note[]> {
    return getNotes();
  }

  async saveNote(note: Note, _userId: string): Promise<Note> {
    await saveNote(note);
    return note;
  }

  async deleteNote(id: string): Promise<void> {
    await deleteNote(id);
  }
}
