import type { Note, Task, Transaction } from "@flote/types";

export interface NoteRepository {
  getNotes(userId: string): Promise<Note[]>;
  saveNote(note: Note, userId: string): Promise<Note>;
  deleteNote(id: string): Promise<void>;
}

export interface TaskRepository {
  getTasks(userId: string): Promise<Task[]>;
  saveTask(task: Task, userId: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  toggleDone(id: string, done: boolean): Promise<void>;
}

export interface TransactionRepository {
  getTransactions(userId: string, from?: string, to?: string): Promise<Transaction[]>;
  saveTransaction(t: Transaction, userId: string): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
}
