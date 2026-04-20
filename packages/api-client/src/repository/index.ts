import type { StorageMode } from "@flote/types";
import type { NoteRepository, TaskRepository } from "./types";
import { LocalNoteRepository } from "./local/noteRepository";
import { LocalTaskRepository } from "./local/taskRepository";
import { SupabaseNoteRepository } from "./supabase/noteRepository";
import { SupabaseTaskRepository } from "./supabase/taskRepository";

export type { NoteRepository, TaskRepository } from "./types";

export function createNoteRepository(mode: StorageMode): NoteRepository {
  switch (mode) {
    case "local":
      return new LocalNoteRepository();
    case "supabase":
      return new SupabaseNoteRepository();
  }
}

export function createTaskRepository(mode: StorageMode): TaskRepository {
  switch (mode) {
    case "local":
      return new LocalTaskRepository();
    case "supabase":
      return new SupabaseTaskRepository();
  }
}
