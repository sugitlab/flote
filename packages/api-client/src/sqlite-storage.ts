import Database from "@tauri-apps/plugin-sql";
import {
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { Note, Task } from "@flote/types";

// ── singleton DB connection ───────────────────────────────────────────────────

let _dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!_dbPromise) {
    _dbPromise = Database.load("sqlite:flote.db");
  }
  return _dbPromise;
}

// ── initialization ────────────────────────────────────────────────────────────

export async function initDb(): Promise<void> {
  const db = await getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id       TEXT PRIMARY KEY,
      title    TEXT NOT NULL DEFAULT '',
      body_md  TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      body_md    TEXT NOT NULL DEFAULT '',
      due_date   TEXT,
      done       INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `);
}

// ── notes ─────────────────────────────────────────────────────────────────────

type NoteRow = { id: string; title: string; body_md: string; updated_at: string };

export async function getNotes(): Promise<Note[]> {
  const db = await getDb();
  return db.select<NoteRow[]>(
    "SELECT id, title, body_md, updated_at FROM notes ORDER BY updated_at DESC"
  );
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO notes (id, title, body_md, updated_at)
     VALUES ($1, $2, $3, $4)`,
    [note.id, note.title, note.body_md, note.updated_at]
  );
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}

// ── tasks ─────────────────────────────────────────────────────────────────────

type TaskRow = {
  id: string;
  title: string;
  body_md: string;
  due_date: string | null;
  done: number;
  updated_at: string;
};

export async function getTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT id, title, body_md, due_date, done, updated_at FROM tasks ORDER BY updated_at DESC"
  );
  return rows.map((r) => ({ ...r, done: r.done === 1 }));
}

export async function saveTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO tasks (id, title, body_md, due_date, done, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [task.id, task.title, task.body_md, task.due_date, task.done ? 1 : 0, task.updated_at]
  );
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

// ── export ────────────────────────────────────────────────────────────────────

export async function exportToJson(notes: Note[], tasks: Task[]): Promise<string> {
  const dir = await appDataDir();
  const exportsDir = await join(dir, "exports");
  if (!(await exists(exportsDir))) {
    await mkdir(exportsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath = await join(exportsDir, `flote-export-${timestamp}.json`);

  await writeTextFile(filePath, JSON.stringify(
    { version: "1.0", exportedAt: new Date().toISOString(), notes, tasks },
    null,
    2
  ));

  return filePath;
}
