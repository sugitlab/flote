import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { Note, Task } from "@flote/types";

const NOTES_FILE = "notes.json";
const TASKS_FILE = "tasks.json";

async function getDataDir(): Promise<string> {
  const dir = await appDataDir();
  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

async function readJsonFile<T>(filename: string): Promise<T[]> {
  const dir = await getDataDir();
  const path = await join(dir, filename);
  const fileExists = await exists(path);
  if (!fileExists) {
    return [];
  }
  const content = await readTextFile(path);
  return JSON.parse(content) as T[];
}

async function writeJsonFile<T>(filename: string, data: T[]): Promise<void> {
  const dir = await getDataDir();
  const path = await join(dir, filename);
  await writeTextFile(path, JSON.stringify(data, null, 2));
}

// Notes

export async function getNotes(): Promise<Note[]> {
  return readJsonFile<Note>(NOTES_FILE);
}

export async function saveNote(note: Note): Promise<void> {
  const notes = await getNotes();
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    notes[idx] = note;
  } else {
    notes.unshift(note);
  }
  await writeJsonFile(NOTES_FILE, notes);
}

export async function deleteNote(id: string): Promise<void> {
  const notes = await getNotes();
  const filtered = notes.filter((n) => n.id !== id);
  await writeJsonFile(NOTES_FILE, filtered);
}

// Tasks

export async function getTasks(): Promise<Task[]> {
  return readJsonFile<Task>(TASKS_FILE);
}

export async function saveTask(task: Task): Promise<void> {
  const tasks = await getTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    tasks[idx] = task;
  } else {
    tasks.unshift(task);
  }
  await writeJsonFile(TASKS_FILE, tasks);
}

export async function deleteTask(id: string): Promise<void> {
  const tasks = await getTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  await writeJsonFile(TASKS_FILE, filtered);
}
