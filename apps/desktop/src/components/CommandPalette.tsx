import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Note, Task } from "@flote/types";
import { useUIStore } from "../store/uiStore";
import styles from "./CommandPalette.module.css";

type Command = {
  id: string;
  label: string;
  kbd?: string;
  action: () => void;
};

type PaletteItem = {
  type: "note" | "task" | "command";
  id: string;
  label: string;
  meta?: string;
  kbd?: string;
  action: () => void;
};

function relativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 24) return `${diffHours}時間前`;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) return `${diffDays}日前`;
  return new Date(dateStr).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

type Props = {
  notes: Note[];
  tasks: Task[];
  onSelectNote: (id: string) => void;
  onSelectTask: (id: string) => void;
  onNewNote: () => void;
  onNewTask: () => void;
  onCycleTheme: () => void;
};

export default function CommandPalette({
  notes,
  tasks,
  onSelectNote,
  onSelectTask,
  onNewNote,
  onNewTask,
  onCycleTheme,
}: Props) {
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setOpen]);

  const commands: Command[] = useMemo(
    () => [
      { id: "new-note", label: "新規ノートを作成", kbd: "⌘N", action: onNewNote },
      { id: "new-task", label: "新規タスクを追加", kbd: "⌘T", action: onNewTask },
      {
        id: "settings",
        label: "設定を開く",
        kbd: "⌘,",
        action: () => setSettingsOpen(true),
      },
      {
        id: "theme",
        label: "テーマを切り替え",
        kbd: "⌘⇧L",
        action: onCycleTheme,
      },
    ],
    [onNewNote, onNewTask, setSettingsOpen, onCycleTheme]
  );

  const items: PaletteItem[] = useMemo(() => {
    const q = query.toLowerCase();
    const result: PaletteItem[] = [];

    const matchedNotes = notes.filter(
      (n) =>
        !q || n.title.toLowerCase().includes(q) || relativeDate(n.updated_at).includes(q)
    );
    for (const n of matchedNotes.slice(0, 8)) {
      result.push({
        type: "note",
        id: n.id,
        label: n.title || "無題のノート",
        meta: relativeDate(n.updated_at),
        action: () => onSelectNote(n.id),
      });
    }

    const matchedTasks = tasks.filter(
      (t) => !q || t.title.toLowerCase().includes(q)
    );
    for (const t of matchedTasks.slice(0, 5)) {
      result.push({
        type: "task",
        id: t.id,
        label: `${t.done ? "✓ " : ""}${t.title}`,
        meta: t.due_date ?? undefined,
        action: () => onSelectTask(t.id),
      });
    }

    const matchedCmds = commands.filter(
      (c) => !q || c.label.toLowerCase().includes(q)
    );
    for (const c of matchedCmds) {
      result.push({
        type: "command",
        id: c.id,
        label: c.label,
        kbd: c.kbd,
        action: c.action,
      });
    }

    return result;
  }, [query, notes, tasks, commands, onSelectNote, onSelectTask]);

  useEffect(() => {
    setFocusIndex(0);
  }, [query]);

  const execute = useCallback(
    (item: PaletteItem) => {
      close();
      item.action();
    },
    [close]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items[focusIndex]) {
        e.preventDefault();
        execute(items[focusIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    },
    [items, focusIndex, execute, close]
  );

  // Group items by type for rendering sections
  const noteItems = items.filter((i) => i.type === "note");
  const taskItems = items.filter((i) => i.type === "task");
  const cmdItems = items.filter((i) => i.type === "command");

  let globalIndex = 0;
  function renderItem(item: PaletteItem) {
    const idx = globalIndex++;
    return (
      <div
        key={`${item.type}-${item.id}`}
        className={`${styles.item} ${idx === focusIndex ? styles.itemFocused : ""}`}
        onClick={() => execute(item)}
        onMouseEnter={() => setFocusIndex(idx)}
      >
        <span className={styles.itemLabel}>{item.label}</span>
        {item.kbd && <span className={styles.itemKbd}>{item.kbd}</span>}
        {item.meta && !item.kbd && (
          <span className={styles.itemMeta}>{item.meta}</span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={close}>
      <div
        className={styles.palette}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.searchWrap}>
          <input
            ref={inputRef}
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索..."
          />
        </div>

        <div className={styles.results}>
          {items.length === 0 && (
            <div className={styles.empty}>一致する結果がありません</div>
          )}

          {noteItems.length > 0 && (
            <>
              <div className={styles.sectionTitle}>ノート</div>
              {noteItems.map(renderItem)}
            </>
          )}

          {taskItems.length > 0 && (
            <>
              <div className={styles.sectionTitle}>タスク</div>
              {taskItems.map(renderItem)}
            </>
          )}

          {cmdItems.length > 0 && (
            <>
              <div className={styles.sectionTitle}>コマンド</div>
              {cmdItems.map(renderItem)}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span>
            <span className={styles.footerKbd}>↑↓</span>移動
          </span>
          <span>
            <span className={styles.footerKbd}>↵</span>開く
          </span>
          <span>
            <span className={styles.footerKbd}>Esc</span>閉じる
          </span>
        </div>
      </div>
    </div>
  );
}
