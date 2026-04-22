export type { Note, NoteInsert, NoteUpdate } from "./note";
export type { Task, TaskInsert, TaskUpdate } from "./task";

export type StorageMode = "local" | "supabase";

export type AppConfig = {
  storageMode: StorageMode;
};

export type CodeTheme =
  | "oneDark"
  | "dracula"
  | "nightOwl"
  | "palenight"
  | "vsDark"
  | "github"
  | "oneLight"
  | "vsLight";

export const CODE_THEME_OPTIONS: { value: CodeTheme; label: string }[] = [
  { value: "oneDark",   label: "One Dark" },
  { value: "dracula",   label: "Dracula" },
  { value: "nightOwl",  label: "Night Owl" },
  { value: "palenight", label: "Palenight" },
  { value: "vsDark",    label: "VS Dark" },
  { value: "github",    label: "GitHub" },
  { value: "oneLight",  label: "One Light" },
  { value: "vsLight",   label: "VS Light" },
];
