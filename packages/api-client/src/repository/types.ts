import type { Note } from "@flote/types";
import type { Task } from "@flote/types";

export interface NoteRepository {
  getNotes(userId?: string): Promise<Note[]>;
  saveNote(note: Note, userId?: string): Promise<Note>;
  deleteNote(id: string): Promise<void>;
}

export interface TaskRepository {
  getTasks(userId?: string): Promise<Task[]>;
  saveTask(task: Task, userId?: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  toggleDone(id: string, done: boolean): Promise<void>;
}
