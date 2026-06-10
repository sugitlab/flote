// Sync cursor for delta sync. Tracks the newest updated_at seen per store so
// the next sync can ask the server only for rows changed since then.
//
// Robustness:
// - 1h overlap window absorbs client clock skew between devices
//   (updated_at is written with the saving device's clock)
// - a full reconcile runs at least every 24h to heal anything the
//   delta path could have missed (skew > 1h, missed tombstones, ...)
// - cursor is per-user; switching accounts forces a full sync

const OVERLAP_MS = 3_600_000; // 1 hour
const FULL_SYNC_INTERVAL_MS = 24 * 3_600_000;

type CursorRecord = {
  userId: string;
  lastSyncMs: number;
  lastFullSyncMs: number;
};

function load(key: string, userId: string): CursorRecord | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const rec = JSON.parse(raw) as CursorRecord;
    if (rec.userId !== userId) return null;
    return rec;
  } catch {
    return null;
  }
}

/** Returns the `since` timestamp for a delta sync, or null when a full sync is due. */
export function getSince(key: string, userId: string): string | null {
  const rec = load(key, userId);
  if (!rec || !rec.lastFullSyncMs) return null;
  if (Date.now() - rec.lastFullSyncMs > FULL_SYNC_INTERVAL_MS) return null;
  return new Date(Math.max(0, rec.lastSyncMs - OVERLAP_MS)).toISOString();
}

/** Advances the cursor after a successful sync. */
export function advanceCursor(
  key: string,
  userId: string,
  seenTimestamps: string[],
  wasFullSync: boolean
): void {
  try {
    const prev = load(key, userId);
    let lastSyncMs = prev?.lastSyncMs ?? 0;
    for (const t of seenTimestamps) {
      const ms = Date.parse(t);
      if (!Number.isNaN(ms) && ms > lastSyncMs) lastSyncMs = ms;
    }
    const rec: CursorRecord = {
      userId,
      lastSyncMs,
      lastFullSyncMs: wasFullSync ? Date.now() : (prev?.lastFullSyncMs ?? 0),
    };
    localStorage.setItem(key, JSON.stringify(rec));
  } catch {
    // non-fatal — worst case the next sync is a full sync
  }
}
