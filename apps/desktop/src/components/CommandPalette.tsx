import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Note, Task } from "@flote/types";
import { useUIStore } from "../store/uiStore";
import { relativeDate } from "../utils/date";
import styles from "./CommandPalette.module.css";

function bodySnippet(body: string, query: string, radius = 40): string {
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + query.length + radius);
  const snippet = body.slice(start, end).replace(/\n/g, " ");
  return (start > 0 ? "…" : "") + snippet + (end < body.length ? "…" : "");
}

type Command = {
  id: string;
  label: string;
  keywords?: string[];
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

type Props = {
  notes: Note[];
  tasks: Task[];
  onSelectNote: (id: string) => void;
  onSelectTask: (id: string) => void;
  onNewNote: () => void;
  onNewTask: () => void;
  onCycleTheme: () => void;
  onShowNotes: () => void;
  onShowTasks: () => void;
};

export default function CommandPalette({
  notes,
  tasks,
  onSelectNote,
  onSelectTask,
  onNewNote,
  onNewTask,
  onCycleTheme,
  onShowNotes,
  onShowTasks,
}: Props) {
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const searchFullText = useUIStore((s) => s.searchFullText);
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, [setOpen]);

  const commands: Command[] = useMemo(
    () => [
      {
        id: "show-notes",
        label: "ノート一覧を表示",
        keywords: ["show notes", "notes", "list notes"],
        kbd: "⌘1",
        action: onShowNotes,
      },
      {
        id: "show-tasks",
        label: "タスク一覧を表示",
        keywords: ["show tasks", "tasks", "list tasks"],
        kbd: "⌘2",
        action: onShowTasks,
      },
      {
        id: "new-note",
        label: "新規ノートを作成",
        keywords: ["add note", "new note", "create note"],
        kbd: "⌘N",
        action: onNewNote,
      },
      {
        id: "new-task",
        label: "新規タスクを追加",
        keywords: ["add task", "new task", "create task"],
        kbd: "⌘T",
        action: onNewTask,
      },
      {
        id: "settings",
        label: "設定を開く",
        keywords: ["settings", "preferences", "config"],
        kbd: "⌘,",
        action: () => setSettingsOpen(true),
      },
      {
        id: "theme",
        label: "テーマを切り替え",
        keywords: ["theme", "toggle theme", "dark mode", "light mode"],
        kbd: "⌘⇧L",
        action: onCycleTheme,
      },
    ],
    [onShowNotes, onShowTasks, onNewNote, onNewTask, setSettingsOpen, onCycleTheme]
  );

  const items: PaletteItem[] = useMemo(() => {
    const q = query.toLowerCase();
    const result: PaletteItem[] = [];

    const matchedNotes = notes.filter((n) => {
      if (!q) return true;
      if (n.title.toLowerCase().includes(q)) return true;
      if (relativeDate(n.updated_at).includes(q)) return true;
      if (searchFullText && n.body_md.toLowerCase().includes(q)) return true;
      return false;
    });
    for (const n of matchedNotes.slice(0, 8)) {
      const inBody =
        searchFullText &&
        q &&
        !n.title.toLowerCase().includes(q) &&
        n.body_md.toLowerCase().includes(q);
      result.push({
        type: "note",
        id: n.id,
        label: n.title || "無題のノート",
        meta: inBody ? bodySnippet(n.body_md, query) : relativeDate(n.updated_at),
        action: () => onSelectNote(n.id),
      });
    }

    const matchedTasks = tasks.filter((t) => {
      if (!q) return true;
      if (t.title.toLowerCase().includes(q)) return true;
      if (searchFullText && t.body_md.toLowerCase().includes(q)) return true;
      return false;
    });
    for (const t of matchedTasks.slice(0, 5)) {
      const inBody =
        searchFullText &&
        q &&
        !t.title.toLowerCase().includes(q) &&
        t.body_md.toLowerCase().includes(q);
      result.push({
        type: "task",
        id: t.id,
        label: `${t.done ? "✓ " : ""}${t.title}`,
        meta: inBody ? bodySnippet(t.body_md, query) : (t.due_date ?? undefined),
        action: () => onSelectTask(t.id),
      });
    }

    const matchedCmds = commands.filter(
      (c) =>
        !q ||
        c.label.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q))
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
  }, [query, notes, tasks, commands, searchFullText, onSelectNote, onSelectTask]);

  useEffect(() => {
    setFocusIndex(0);
  }, [query]);

  // Scroll focused item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const focused = container.querySelector(`[data-index="${focusIndex}"]`);
    if (focused) {
      focused.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex]);

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
        setKeyboardNav(true);
        setFocusIndex((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setFocusIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && items[focusIndex] && !composingRef.current) {
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
        data-index={idx}
        className={`${styles.item} ${idx === focusIndex ? styles.itemFocused : ""}`}
        onClick={() => execute(item)}
        onMouseMove={() => {
          if (keyboardNav) setKeyboardNav(false);
        }}
        onMouseEnter={() => {
          if (!keyboardNav) setFocusIndex(idx);
        }}
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
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { setTimeout(() => { composingRef.current = false; }, 0); }}
            placeholder="検索..."
          />
        </div>

        <div ref={resultsRef} className={styles.results}>
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
