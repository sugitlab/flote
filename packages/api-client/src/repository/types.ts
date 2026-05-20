import type { Note, Task, Transaction } from "@flote/types";

export interface NoteRepository {
  getNotes(userId: string): Promise<Note[]>;
  getNoteById(id: string): Promise<Note | null>;
  saveNote(note: Note, userId: string): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  deleteNotesBatch(ids: string[]): Promise<void>;
}

export interface TaskRepository {
  getTasks(userId: string): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  saveTask(task: Task, userId: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  deleteTasksBatch(ids: string[]): Promise<void>;
}

export interface TransactionRepository {
  getTransactions(userId: string, from?: string, to?: string): Promise<Transaction[]>;
  saveTransaction(t: Transaction, userId: string): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
}
