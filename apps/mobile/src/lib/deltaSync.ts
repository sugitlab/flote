// Delta-sync cursor + tombstone fetch (mirrors the desktop implementation).
// - 1h overlap absorbs client clock skew between devices
// - a full reconcile runs at least every 24h to heal anything missed
import { supabase } from "./supabase";

const OVERLAP_MS = 3_600_000; // 1 hour
const FULL_SYNC_INTERVAL_MS = 24 * 3_600_000;

export type SyncCursor = {
  userId: string;
  lastSyncMs: number;
  lastFullSyncMs: number;
};

/** Returns the `since` timestamp for a delta sync, or null when a full sync is due. */
export function getSince(cursor: SyncCursor | null, userId: string): string | null {
  if (!cursor || cursor.userId !== userId || !cursor.lastFullSyncMs) return null;
  if (Date.now() - cursor.lastFullSyncMs > FULL_SYNC_INTERVAL_MS) return null;
  return new Date(Math.max(0, cursor.lastSyncMs - OVERLAP_MS)).toISOString();
}

/** Computes the advanced cursor after a successful sync. */
export function advanceCursor(
  prev: SyncCursor | null,
  userId: string,
  seenTimestamps: string[],
  wasFullSync: boolean
): SyncCursor {
  const valid = prev && prev.userId === userId ? prev : null;
  let lastSyncMs = valid?.lastSyncMs ?? 0;
  for (const t of seenTimestamps) {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms) && ms > lastSyncMs) lastSyncMs = ms;
  }
  return {
    userId,
    lastSyncMs,
    lastFullSyncMs: wasFullSync ? Date.now() : (valid?.lastFullSyncMs ?? 0),
  };
}

/**
 * IDs deleted at or after `since` (tombstones).
 * Returns null when the deletions table is missing — caller must full-sync.
 */
export async function fetchDeletions(
  userId: string,
  since: string,
  kind: "notes" | "tasks"
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("deletions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("deleted_at", since);
  if (error) return null;
  return (data ?? []).map((r) => String(r.id));
}
