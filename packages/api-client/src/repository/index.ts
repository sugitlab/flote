import type { StorageMode } from "@flote/types";
import type { NoteRepository, TaskRepository, TransactionRepository } from "./types";
import { LocalNoteRepository } from "./local/noteRepository";
import { LocalTaskRepository } from "./local/taskRepository";
import { LocalTransactionRepository } from "./local/transactionRepository";
import { SupabaseNoteRepository } from "./supabase/noteRepository";
import { SupabaseTaskRepository } from "./supabase/taskRepository";
import { SupabaseTransactionRepository } from "./supabase/transactionRepository";

export type { NoteRepository, TaskRepository, TransactionRepository, NoteManifest, TaskManifest } from "./types";

export function createNoteRepository(mode: StorageMode): NoteRepository {
  switch (mode) {
    case "local":
      return new LocalNoteRepository();
    case "supabase":
    case "selfhost":
      return new SupabaseNoteRepository();
  }
}

export function createTaskRepository(mode: StorageMode): TaskRepository {
  switch (mode) {
    case "local":
      return new LocalTaskRepository();
    case "supabase":
    case "selfhost":
      return new SupabaseTaskRepository();
  }
}

export function createTransactionRepository(mode: StorageMode): TransactionRepository {
  switch (mode) {
    case "local":
      return new LocalTransactionRepository();
    case "supabase":
    case "selfhost":
      return new SupabaseTransactionRepository();
  }
}
