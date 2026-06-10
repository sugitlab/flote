import { useEffect } from "react";
import { getSupabase } from "@flote/api-client";
import { useNoteStore } from "../store/noteStore";
import { useTaskStore } from "../store/taskStore";
import type { Note, Task, StorageMode } from "@flote/types";

// Slim sync events sent by the notify_sync database trigger (migration 009).
// postgres_changes streamed every column — including megabyte-scale body_md —
// to every connected client on each save. The broadcast carries only ids;
// the client fetches the single changed row on demand.
type SyncPayload = {
  kind: "notes" | "tasks";
  event: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  updated_at: string;
};

function isNewer(remote: string, local: string | undefined): boolean {
  if (!local) return true;
  const r = Date.parse(remote);
  const l = Date.parse(local);
  if (Number.isNaN(r) || Number.isNaN(l)) return remote > local;
  return r > l;
}

function deletedNoteStub(id: string, updated_at: string): Note {
  return { id, title: "", body_md: "", pinned: false, note_type: "markdown", updated_at };
}

function deletedTaskStub(id: string, updated_at: string): Task {
  return { id, title: "", body_md: "", due_date: null, status: "Todo", pinned: false, updated_at };
}

async function handleSyncEvent(p: SyncPayload): Promise<void> {
  if (p.kind === "notes") {
    const s = useNoteStore.getState();
    if (p.event === "DELETE") {
      s.applyRemoteChange("DELETE", deletedNoteStub(p.id, p.updated_at ?? ""));
      return;
    }
    const local = s.notes.find((n) => n.id === p.id);
    // Skip own echoes and stale events without any fetch
    if (local && !isNewer(p.updated_at, local.updated_at)) return;
    const note = await s.repo?.getNoteById(p.id);
    if (note) useNoteStore.getState().applyRemoteChange(local ? "UPDATE" : "INSERT", note);
  } else if (p.kind === "tasks") {
    const s = useTaskStore.getState();
    if (p.event === "DELETE") {
      s.applyRemoteChange("DELETE", deletedTaskStub(p.id, p.updated_at ?? ""));
      return;
    }
    const local = s.tasks.find((t) => t.id === p.id);
    if (local && !isNewer(p.updated_at, local.updated_at)) return;
    const task = await s.repo?.getTaskById(p.id);
    if (task) useTaskStore.getState().applyRemoteChange(local ? "UPDATE" : "INSERT", task);
  }
}

export function useRealtime(
  userId: string | undefined,
  storageMode: StorageMode
) {
  useEffect(() => {
    if (storageMode === "local" || !userId) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`sync:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "change" }, ({ payload }) => {
        const p = payload as SyncPayload | undefined;
        if (!p || !p.kind || !p.id) return;
        handleSyncEvent(p).catch((e) => {
          console.error("[useRealtime] failed to apply sync event:", e);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, storageMode]);
}
