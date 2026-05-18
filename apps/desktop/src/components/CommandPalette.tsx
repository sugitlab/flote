import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Note, Task } from "@flote/types";
import { useUIStore } from "../store/uiStore";
import { relativeDate } from "../utils/date";
import { extractTags, allTagsFromNotes } from "../utils/tags";
import { useT } from "../hooks/useT";
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
  onFilterByTag?: (tag: string) => void;
  onSync?: () => void;
  canSync?: boolean;
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
  onFilterByTag,
  onSync,
  canSync,
}: Props) {
  const t = useT();
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const searchFullText = useUIStore((s) => s.searchFullText);
  const hideCompletedInSearch = useUIStore((s) => s.hideCompletedInSearch);
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
        label: t.palette.commands.showNotes,
        keywords: ["show notes", "notes", "list notes"],
        kbd: "⌘1",
        action: onShowNotes,
      },
      {
        id: "show-tasks",
        label: t.palette.commands.showTasks,
        keywords: ["show tasks", "tasks", "list tasks"],
        kbd: "⌘2",
        action: onShowTasks,
      },
      {
        id: "new-note",
        label: t.palette.commands.newNote,
        keywords: ["add note", "new note", "create note"],
        kbd: "⌘N",
        action: onNewNote,
      },
      {
        id: "new-task",
        label: t.palette.commands.newTask,
        keywords: ["add task", "new task", "create task"],
        kbd: "⌘T",
        action: onNewTask,
      },
      {
        id: "settings",
        label: t.palette.commands.settings,
        keywords: ["settings", "preferences", "config"],
        kbd: "⌘,",
        action: () => setSettingsOpen(true),
      },
      {
        id: "theme",
        label: t.palette.commands.toggleTheme,
        keywords: ["theme", "toggle theme", "dark mode", "light mode"],
        kbd: "⌘⇧L",
        action: onCycleTheme,
      },
      ...(canSync && onSync
        ? [
            {
              id: "sync",
              label: t.palette.commands.sync,
              keywords: ["sync", "同期", "refresh", "reload", "cloud"],
              action: onSync,
            },
          ]
        : []),
    ],
    [t, onShowNotes, onShowTasks, onNewNote, onNewTask, setSettingsOpen, onCycleTheme, onSync, canSync]
  );

  const isTagSearch = query.startsWith("#");

  const allTags = useMemo(() => allTagsFromNotes(notes), [notes]);

  const items: PaletteItem[] = useMemo(() => {
    const result: PaletteItem[] = [];

    if (isTagSearch) {
      const tagQ = query.slice(1).toLowerCase();
      const matchedTags = allTags.filter((t) => !tagQ || t.toLowerCase().includes(tagQ));
      for (const tag of matchedTags) {
        const count = notes.filter((n) => extractTags(n.body_md).includes(tag)).length;
        result.push({
          type: "command",
          id: `tag:${tag}`,
          label: `#${tag}`,
          meta: t.palette.tagCount(count),
          action: () => {
            onFilterByTag?.(tag);
            onShowNotes();
          },
        });
      }
      const taggedNotes = tagQ
        ? notes.filter((n) => extractTags(n.body_md).some((t) => t.toLowerCase().includes(tagQ)))
        : [];
      for (const n of taggedNotes.slice(0, 6)) {
        result.push({
          type: "note",
          id: n.id,
          label: n.title || t.defaults.untitledNote,
          meta: relativeDate(n.updated_at, t.date),
          action: () => onSelectNote(n.id),
        });
      }
      return result;
    }

    const q = query.toLowerCase();

    const matchedNotes = notes.filter((n) => {
      if (!q) return true;
      if (n.title.toLowerCase().includes(q)) return true;
      if (relativeDate(n.updated_at, t.date).includes(q)) return true;
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
        label: n.title || t.defaults.untitledNote,
        meta: inBody ? bodySnippet(n.body_md, query) : relativeDate(n.updated_at, t.date),
        action: () => onSelectNote(n.id),
      });
    }

    const matchedTasks = tasks.filter((task) => {
      if (hideCompletedInSearch && task.done) return false;
      if (!q) return true;
      if (task.title.toLowerCase().includes(q)) return true;
      if (searchFullText && task.body_md.toLowerCase().includes(q)) return true;
      return false;
    });
    for (const task of matchedTasks.slice(0, 5)) {
      const inBody =
        searchFullText &&
        q &&
        !task.title.toLowerCase().includes(q) &&
        task.body_md.toLowerCase().includes(q);
      result.push({
        type: "task",
        id: task.id,
        label: `${task.done ? "✓ " : ""}${task.title}`,
        meta: inBody ? bodySnippet(task.body_md, query) : (task.due_date ?? undefined),
        action: () => onSelectTask(task.id),
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
  }, [t, query, isTagSearch, allTags, notes, tasks, commands, searchFullText, hideCompletedInSearch, onSelectNote, onSelectTask, onFilterByTag, onShowNotes]);

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
            placeholder={t.palette.placeholder}
          />
        </div>

        <div ref={resultsRef} className={styles.results}>
          {items.length === 0 && (
            <div className={styles.empty}>{t.palette.noResults}</div>
          )}

          {isTagSearch ? (
            <>
              {cmdItems.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>{t.palette.sections.tags}</div>
                  {cmdItems.map(renderItem)}
                </>
              )}
              {noteItems.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>{t.palette.sections.notes}</div>
                  {noteItems.map(renderItem)}
                </>
              )}
            </>
          ) : (
            <>
              {noteItems.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>{t.palette.sections.notes}</div>
                  {noteItems.map(renderItem)}
                </>
              )}
              {taskItems.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>{t.palette.sections.tasks}</div>
                  {taskItems.map(renderItem)}
                </>
              )}
              {cmdItems.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>{t.palette.sections.commands}</div>
                  {cmdItems.map(renderItem)}
                </>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <span>
            <span className={styles.footerKbd}>↑↓</span>{t.palette.footer.navigate}
          </span>
          <span>
            <span className={styles.footerKbd}>↵</span>{t.palette.footer.open}
          </span>
          <span>
            <span className={styles.footerKbd}>Esc</span>{t.palette.footer.close}
          </span>
        </div>
      </div>
    </div>
  );
}
