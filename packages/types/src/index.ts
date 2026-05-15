export type { Note, NoteInsert, NoteUpdate } from "./note";
export type { Task, TaskInsert, TaskUpdate } from "./task";
export type { Transaction, TransactionInsert, TransactionType } from "./expense";

export type StorageMode = "local" | "supabase" | "selfhost";

export type AppConfig = {
  storageMode: StorageMode;
};

export type DarkCodeTheme = "oneDark" | "dracula" | "nightOwl" | "vsDark";
export type LightCodeTheme = "github" | "oneLight" | "vsLight" | "solarizedLight";
export type CodeTheme = DarkCodeTheme | LightCodeTheme;

export const DARK_CODE_THEME_OPTIONS: { value: DarkCodeTheme; label: string }[] = [
  { value: "oneDark",  label: "One Dark" },
  { value: "dracula",  label: "Dracula" },
  { value: "nightOwl", label: "Night Owl" },
  { value: "vsDark",   label: "VS Dark" },
];

export const LIGHT_CODE_THEME_OPTIONS: { value: LightCodeTheme; label: string }[] = [
  { value: "github",        label: "GitHub" },
  { value: "oneLight",      label: "One Light" },
  { value: "vsLight",       label: "VS Light" },
  { value: "solarizedLight", label: "Solarized Light" },
];

export const CODE_THEME_OPTIONS: { value: CodeTheme; label: string }[] = [
  ...DARK_CODE_THEME_OPTIONS,
  ...LIGHT_CODE_THEME_OPTIONS,
];
