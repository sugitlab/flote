import Database from "@tauri-apps/plugin-sql";
import { writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { Note, Task, TaskStatus, Transaction } from "@flote/types";

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
      status     TEXT NOT NULL DEFAULT 'Todo',
      updated_at TEXT NOT NULL
    )
  `);
  // Migration: add status column to existing DBs that only have done column
  try {
    await db.execute(`ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'Todo'`);
    await db.execute(`UPDATE tasks SET status = 'Done' WHERE done = 1 AND status = 'Todo'`);
  } catch {
    // Column already exists or table was just created with status — no-op
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS transactions (
      id          TEXT PRIMARY KEY,
      date        TEXT NOT NULL,
      amount      INTEGER NOT NULL,
      type        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category    TEXT NOT NULL DEFAULT '',
      account     TEXT NOT NULL DEFAULT '',
      updated_at  TEXT NOT NULL
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

export async function getNoteById(id: string): Promise<Note | null> {
  const db = await getDb();
  const rows = await db.select<NoteRow[]>(
    "SELECT id, title, body_md, updated_at FROM notes WHERE id = $1",
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
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
  status: string;
  updated_at: string;
};

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    body_md: r.body_md,
    due_date: r.due_date,
    status: (r.status ?? "Todo") as TaskStatus,
    updated_at: r.updated_at,
  };
}

export async function getTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT id, title, body_md, due_date, status, updated_at FROM tasks ORDER BY updated_at DESC"
  );
  return rows.map(rowToTask);
}

export async function saveTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO tasks (id, title, body_md, due_date, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [task.id, task.title, task.body_md, task.due_date, task.status, task.updated_at]
  );
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    "SELECT id, title, body_md, due_date, status, updated_at FROM tasks WHERE id = $1",
    [id]
  );
  if (rows.length === 0) return null;
  return rowToTask(rows[0]);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

// ── transactions ──────────────────────────────────────────────────────────────

type TransactionRow = {
  id: string;
  date: string;
  amount: number;
  type: string;
  description: string;
  category: string;
  account: string;
  updated_at: string;
};

export async function getTransactions(from?: string, to?: string): Promise<Transaction[]> {
  const db = await getDb();
  let sql = "SELECT id, date, amount, type, description, category, account, updated_at FROM transactions";
  const params: string[] = [];
  if (from && to) {
    sql += " WHERE date >= $1 AND date <= $2";
    params.push(from, to);
  } else if (from) {
    sql += " WHERE date >= $1";
    params.push(from);
  } else if (to) {
    sql += " WHERE date <= $1";
    params.push(to);
  }
  sql += " ORDER BY date DESC, updated_at DESC";
  const rows = await db.select<TransactionRow[]>(sql, params);
  return rows.map((r) => ({
    ...r,
    type: r.type as Transaction["type"],
  }));
}

export async function saveTransaction(t: Transaction): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO transactions (id, date, amount, type, description, category, account, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [t.id, t.date, t.amount, t.type, t.description, t.category, t.account, t.updated_at]
  );
}

export async function deleteTransaction(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM transactions WHERE id = $1", [id]);
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
    `status: "${task.status}"`,
  ];
  if (task.due_date) lines.push(`due_date: "${task.due_date}"`);
  lines.push(`updated_at: "${task.updated_at}"`, "---", "");
  return lines.join("\n");
}

// Returns the export folder path so the caller can reveal it in Finder.
export async function exportToMarkdown(notes: Note[], tasks: Task[]): Promise<string> {
  const base = await appDataDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const exportDir = await join(base, "exports", `flote-export-${timestamp}`);
  const notesDir = await join(exportDir, "notes");
  const tasksDir = await join(exportDir, "tasks");

  for (const dir of [notesDir, tasksDir]) {
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  }

  const usedNotes = new Set<string>();
  for (const note of notes) {
    const filename = uniqueName(sanitizeFilename(note.title || note.id), usedNotes);
    await writeTextFile(await join(notesDir, filename), noteFrontmatter(note) + note.body_md);
  }

  const usedTasks = new Set<string>();
  for (const task of tasks) {
    const filename = uniqueName(sanitizeFilename(task.title || task.id), usedTasks);
    await writeTextFile(await join(tasksDir, filename), taskFrontmatter(task) + task.body_md);
  }

  return exportDir;
}
