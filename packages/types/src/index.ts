export type { Note, NoteInsert, NoteUpdate } from "./note";
export type { Task, TaskInsert, TaskUpdate } from "./task";

export type StorageMode = "local" | "supabase";

export type AppConfig = {
  storageMode: StorageMode;
};
