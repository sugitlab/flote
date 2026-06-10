// File-system backed cache (expo-file-system).
// Mobile previously kept everything in memory only, so every cold start
// re-downloaded the full manifest plus up to 100 bodies from Supabase.
// Mirrors the desktop strategy: metadata persisted as JSON, bodies cached
// per note/task keyed by (id, updated_at).
import * as FileSystem from "expo-file-system";

const ROOT = `${FileSystem.documentDirectory}flote-cache/`;

let rootReady: Promise<void> | null = null;
function ensureRoot(): Promise<void> {
  if (!rootReady) {
    rootReady = FileSystem.makeDirectoryAsync(ROOT, { intermediates: true }).catch(() => {});
  }
  return rootReady;
}

export async function readJson<T>(name: string): Promise<T | null> {
  try {
    await ensureRoot();
    const content = await FileSystem.readAsStringAsync(ROOT + name);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJson(name: string, value: unknown): Promise<void> {
  try {
    await ensureRoot();
    await FileSystem.writeAsStringAsync(ROOT + name, JSON.stringify(value));
  } catch {
    // non-fatal — cache misses just fall back to the server
  }
}

export async function removeFile(name: string): Promise<void> {
  try {
    await ensureRoot();
    await FileSystem.deleteAsync(ROOT + name, { idempotent: true });
  } catch {
    // ignore
  }
}

export type BodyEntry = { body_md: string; updated_at: string };

export async function readBodies(
  prefix: string,
  ids: string[]
): Promise<Map<string, BodyEntry>> {
  const result = new Map<string, BodyEntry>();
  await Promise.all(
    ids.map(async (id) => {
      const entry = await readJson<BodyEntry>(`${prefix}${id}.json`);
      if (entry) result.set(id, entry);
    })
  );
  return result;
}

export function writeBody(prefix: string, id: string, entry: BodyEntry): void {
  void writeJson(`${prefix}${id}.json`, entry);
}

export function removeBody(prefix: string, id: string): void {
  void removeFile(`${prefix}${id}.json`);
}
