import { useEffect } from "react";
import { getSupabase } from "@flote/api-client";
import { useNoteStore } from "../store/noteStore";
import { useTaskStore } from "../store/taskStore";
import type { Note, Task, StorageMode } from "@flote/types";

function toNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    title: (row.title as string) ?? "",
    body_md: (row.body_md as string) ?? "",
    updated_at: row.updated_at as string,
  };
}

function toTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    title: row.title as string,
    due_date: row.due_date as string | null,
    remind_at: row.remind_at as string | null,
    done: row.done as boolean,
    updated_at: row.updated_at as string,
  };
}

export function useRealtime(
  userId: string | undefined,
  storageMode: StorageMode
) {
  const applyNoteChange = useNoteStore((s) => s.applyRemoteChange);
  const applyTaskChange = useTaskStore((s) => s.applyRemoteChange);

  useEffect(() => {
    if (storageMode !== "supabase" || !userId) return;

    const supabase = getSupabase();

    const channel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          if (eventType === "DELETE") {
            const old = payload.old as Record<string, unknown>;
            applyNoteChange("DELETE", toNote(old));
          } else {
            const row = payload.new as Record<string, unknown>;
            applyNoteChange(eventType, toNote(row));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          if (eventType === "DELETE") {
            const old = payload.old as Record<string, unknown>;
            applyTaskChange("DELETE", toTask(old));
          } else {
            const row = payload.new as Record<string, unknown>;
            applyTaskChange(eventType, toTask(row));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, storageMode, applyNoteChange, applyTaskChange]);
}
