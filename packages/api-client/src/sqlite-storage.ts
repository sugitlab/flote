import Database from "@tauri-apps/plugin-sql";
import { writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
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

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 80) || "untitled";
}

function uniqueName(base: string, used: Set<string>): string {
  let name = `${base}.md`;
  let i = 1;
  while (used.has(name)) { name = `${base}-${i++}.md`; }
  used.add(name);
  return name;
}

function noteFrontmatter(note: Note): string {
  return [
    "---",
    `id: "${note.id}"`,
    `title: ${JSON.stringify(note.title)}`,
    `updated_at: "${note.updated_at}"`,
    "---",
    "",
  ].join("\n");
}

function taskFrontmatter(task: Task): string {
  const lines = [
    "---",
    `id: "${task.id}"`,
    `title: ${JSON.stringify(task.title)}`,
    `done: ${task.done}`,
  ];
  if (task.due_date) lines.push(`due_date: "${task.due_date}"`);
  lines.push(`updated_at: "${task.updated_at}"`, "---", "");
  return lines.join("\n");
}

export async function exportToMarkdown(
  notes: Note[],
  tasks: Task[],
  destDir: string
): Promise<void> {
  const notesDir = await join(destDir, "notes");
  const tasksDir = await join(destDir, "tasks");

  for (const dir of [notesDir, tasksDir]) {
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  }

  const usedNotes = new Set<string>();
  for (const note of notes) {
    const filename = uniqueName(sanitizeFilename(note.title || note.id), usedNotes);
    await writeTextFile(
      await join(notesDir, filename),
      noteFrontmatter(note) + note.body_md
    );
  }

  const usedTasks = new Set<string>();
  for (const task of tasks) {
    const filename = uniqueName(sanitizeFilename(task.title || task.id), usedTasks);
    await writeTextFile(
      await join(tasksDir, filename),
      taskFrontmatter(task) + task.body_md
    );
  }
}
