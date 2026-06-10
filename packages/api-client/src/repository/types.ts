import type { Note, Task, Transaction } from "@flote/types";

export type NoteManifest = {
  id: string;
  title: string;
  pinned: boolean;
  note_type: Note["note_type"];
  updated_at: string;
};

export type TaskManifest = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  pinned: boolean;
  updated_at: string;
};

export interface NoteRepository {
  getNotes(userId: string): Promise<Note[]>;
  getNoteById(id: string): Promise<Note | null>;
  /**
   * Lightweight metadata — no body_md. Used for incremental sync.
   * When `since` is given, only rows with updated_at >= since are returned.
   */
  getManifest(userId: string, since?: string): Promise<NoteManifest[]>;
  /**
   * IDs of notes deleted at or after `since` (tombstones).
   * Returns null when tombstones are unsupported (deletions table missing) —
   * the caller must fall back to a full-manifest sync.
   */
  getDeletions(userId: string, since: string): Promise<string[] | null>;
  /** Fetch full notes (with body_md) for the given IDs. */
  getNotesByIds(ids: string[]): Promise<Note[]>;
  saveNote(note: Note, userId: string): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  deleteNotesBatch(ids: string[]): Promise<void>;
}

export interface TaskRepository {
  getTasks(userId: string): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  /**
   * Lightweight metadata — no body_md. Used for incremental sync.
   * When `since` is given, only rows with updated_at >= since are returned.
   */
  getManifest(userId: string, since?: string): Promise<TaskManifest[]>;
  /**
   * IDs of tasks deleted at or after `since` (tombstones).
   * Returns null when tombstones are unsupported (deletions table missing) —
   * the caller must fall back to a full-manifest sync.
   */
  getDeletions(userId: string, since: string): Promise<string[] | null>;
  /** Fetch full tasks (with body_md) for the given IDs. */
  getTasksByIds(ids: string[]): Promise<Task[]>;
  saveTask(task: Task, userId: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  deleteTasksBatch(ids: string[]): Promise<void>;
}

export interface TransactionRepository {
  getTransactions(userId: string, from?: string, to?: string): Promise<Transaction[]>;
  saveTransaction(t: Transaction, userId: string): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
}
