import type { Note } from "@flote/types";
import type { NoteRepository } from "../types";
import {
  getNotes as getLocalNotes,
  saveNote as saveLocalNote,
  deleteNote as deleteLocalNote,
} from "../../local-storage";

export class LocalNoteRepository implements NoteRepository {
  async getNotes(_userId: string): Promise<Note[]> {
    return getLocalNotes();
  }

  async saveNote(note: Note, _userId: string): Promise<Note> {
    await saveLocalNote(note);
    return note;
  }

  async deleteNote(id: string): Promise<void> {
    await deleteLocalNote(id);
  }
}
