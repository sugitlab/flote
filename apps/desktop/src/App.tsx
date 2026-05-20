import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Note, Task, TaskStatus, StorageMode } from "@flote/types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  initSupabase,
  reinitSupabase,
  getSupabase,
  createNoteRepository,
  createTaskRepository,
  createTransactionRepository,
  initDb,
} from "@flote/api-client";
import { getConfig, setConfig } from "./config";
import { checkSchema } from "./migrations";
import { useT } from "./hooks/useT";
import { extractTags } from "./utils/tags";
import SchemaSetup from "./components/SchemaSetup";
import { useAuth } from "./hooks/useAuth";
import { useRealtime } from "./hooks/useRealtime";
import { useBadge } from "./hooks/useBadge";
import { useTheme } from "./hooks/useTheme";
import { useKeyboard } from "./hooks/useKeyboard";
import { useNoteStore } from "./store/noteStore";
import { useTaskStore } from "./store/taskStore";
import { useExpenseStore } from "./store/expenseStore";
import { useUIStore } from "./store/uiStore";
import Auth from "./components/Auth";
import Editor from "./components/Editor";
import NoteList from "./components/NoteList";
import TaskList, { groupTasks } from "./components/TaskList";
import Settings from "./components/Settings";
import CommandPalette from "./components/CommandPalette";
import ConfirmDialog from "./components/ConfirmDialog";
import ResizeHandles from "./components/ResizeHandles";
import ToastContainer from "./components/Toast";
import FloteLogo from "./components/FloteLogo";
import ExpensePanel from "./components/ExpensePanel";
import DatePicker from "./components/DatePicker";
import styles from "./App.module.css";

// Initialize Supabase client from env vars (fast path for developer builds)
const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envSupabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (envSupabaseUrl && envSupabaseKey) {
  initSupabase(envSupabaseUrl, envSupabaseKey);
}

function extractTitle(bodyMd: string, fallback = "Untitled Note"): string {
  const firstLine = bodyMd.split("\n")[0]?.replace(/^#+\s*/, "").trim();
  return firstLine || fallback;
}

function countWords(text: string): number {
  if (!text.trim()) return 0;
  // Count CJK characters individually + space-delimited words
  const cjk = text.match(/[\u3000-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const words = text
    .replace(/[\u3000-\u9fff\uf900-\ufaff]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + words;
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  Todo: "#6b7280",
  InProgress: "#3b82f6",
  Waiting: "#f59e0b",
  Reviewing: "#8b5cf6",
  NoPlan: "#9ca3af",
  HalfwaySpot: "#06b6d4",
  LastEffort: "#ef4444",
  Done: "#22c55e",
};

function countOverdue(tasks: Task[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter((t) => t.status !== "Done" && t.due_date && t.due_date <= today)
    .length;
}

/* ─── MainApp ─── */

function MainApp({
  userId,
  storageMode,
  onSignOut,
  onStorageModeChange,
}: {
  userId?: string;
  storageMode: StorageMode;
  onSignOut?: () => void;
  onStorageModeChange?: (mode: StorageMode) => void;
}) {
  const {
    notes,
    activeNoteId,
    fetchNotes,
    saveNote,
    deleteNote,
    deleteNotesBatch,
    togglePin: toggleNotePin,
    setActiveNote,
    ensureBodyMd: ensureNoteBodyMd,
  } = useNoteStore();
  const {
    tasks,
    activeTaskId,
    fetchTasks,
    saveTask,
    deleteTask,
    deleteTasksBatch,
    updateStatus,
    togglePin: toggleTaskPin,
    setActiveTask,
    ensureBodyMd: ensureTaskBodyMd,
  } = useTaskStore();

  const { fetchTransactions } = useExpenseStore();

  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  pinnedRef.current = pinned;

  const t = useT();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const addToast = useUIStore((s) => s.addToast);
  const setSearchFullText = useUIStore((s) => s.setSearchFullText);
  const setHideCompletedInSearch = useUIStore((s) => s.setHideCompletedInSearch);
  const editorThemeDark = useUIStore((s) => s.editorThemeDark);
  const editorThemeLight = useUIStore((s) => s.editorThemeLight);
  const setEditorThemeDark = useUIStore((s) => s.setEditorThemeDark);
  const setEditorThemeLight = useUIStore((s) => s.setEditorThemeLight);
  const vimMode = useUIStore((s) => s.vimMode);
  const setVimMode = useUIStore((s) => s.setVimMode);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const uiTheme = useUIStore((s) => s.theme);

  const SIDEBAR_MIN = 150;
  const SIDEBAR_MAX = 500;
  const [notesSidebarWidth, setNotesSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("notesSidebarWidth");
    return saved ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Number(saved))) : 200;
  });
  const [tasksSidebarWidth, setTasksSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem("tasksSidebarWidth");
    return saved ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Number(saved))) : 200;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const isNotes = activeTab === "notes";
    const storageKey = isNotes ? "notesSidebarWidth" : "tasksSidebarWidth";
    const currentWidth = isNotes ? notesSidebarWidth : tasksSidebarWidth;
    const setWidth = isNotes ? setNotesSidebarWidth : setTasksSidebarWidth;

    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = currentWidth;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + ev.clientX - dragStartX.current));
      setWidth(next);
    };
    const onUp = (ev: MouseEvent) => {
      isDragging.current = false;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + ev.clientX - dragStartX.current));
      localStorage.setItem(storageKey, String(next));
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [activeTab, notesSidebarWidth, tasksSidebarWidth]);

  const [isEditing, setIsEditing] = useState(false);
  const [activeNoteTag, setActiveNoteTag] = useState<string | null>(null);
  const [activeTaskTag, setActiveTaskTag] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "note" | "task"; id: string } | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<{ type: "note" | "task"; id: string } | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const { cycleTheme } = useTheme();

  const resolvedDark =
    uiTheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : uiTheme === "dark";
  const activeEditorTheme = resolvedDark ? editorThemeDark : editorThemeLight;

  const selectedNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const selectedTask = tasks.find((t) => t.id === activeTaskId) ?? null;
  const wordCount = selectedNote ? countWords(selectedNote.body_md) : 0;
  const overdueCount = countOverdue(tasks);

  useRealtime(userId, storageMode);
  useBadge();

  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector("[data-status-dropdown]");
      if (el && !el.contains(e.target as Node)) setStatusDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [statusDropdownOpen]);

  useEffect(() => {
    Promise.all([
      fetchNotes(userId),
      fetchTasks(userId),
      fetchTransactions(userId),
    ]).catch(console.error);
  }, [userId, storageMode]); // store functions are stable Zustand references

  const handleSync = useCallback(() => {
    Promise.all([
      fetchNotes(userId),
      fetchTasks(userId),
      fetchTransactions(userId),
    ]).catch(console.error);
  }, [userId, fetchNotes, fetchTasks, fetchTransactions]);

  // Receive notes saved from the Quick Capture window
  useEffect(() => {
    const unlisten = listen<{ text: string }>("quick-note", (event) => {
      const { text } = event.payload;
      const note: Note = {
        id: crypto.randomUUID(),
        title: extractTitle(text, t.defaults.untitledNote) || text.slice(0, 60),
        body_md: text,
        pinned: false,
        updated_at: new Date().toISOString(),
      };
      saveNote(note, userId);
      addToast("success", t.toasts.quickNoteSaved);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [userId]); // saveNote and addToast are stable Zustand references

  const [sidebarToggleShortcut, setSidebarToggleShortcut] = useState("CmdOrCtrl+B");

  useEffect(() => {
    getConfig().then((c) => {
      setSearchFullText(c.searchFullText);
      setHideCompletedInSearch(c.hideCompletedInSearch);
      setEditorThemeDark(c.editorThemeDark);
      setEditorThemeLight(c.editorThemeLight);
      setVimMode(c.vimMode);
      if (c.sidebarToggleShortcut) setSidebarToggleShortcut(c.sidebarToggleShortcut);
      if (c.sidebarWidth) {
        const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, c.sidebarWidth));
        if (!localStorage.getItem("notesSidebarWidth")) setNotesSidebarWidth(w);
        if (!localStorage.getItem("tasksSidebarWidth")) setTasksSidebarWidth(w);
      }
    });
  }, []);

  // Hide window when it loses focus (if setting enabled)
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged(async ({ payload: focused }) => {
      if (focused) {
        // Reset suppress flag whenever window regains focus (file picker closed, Finder dismissed, etc.)
        useUIStore.getState().setSuppressHideOnBlur(false);
        return;
      }
      if (!pinnedRef.current && !useUIStore.getState().suppressHideOnBlur) {
        const config = await getConfig();
        if (config.hideOnBlur) {
          await win.hide();
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Refs always reflect the latest values without being effect dependencies.
  // This lets the cleanup effects fire only on ID changes, not on every render.
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const deleteNoteRef = useRef(deleteNote);
  deleteNoteRef.current = deleteNote;
  const deleteTaskRef = useRef(deleteTask);
  deleteTaskRef.current = deleteTask;
  const activeNoteIdRef = useRef(activeNoteId);
  activeNoteIdRef.current = activeNoteId;
  const activeTaskIdRef = useRef(activeTaskId);
  activeTaskIdRef.current = activeTaskId;

  // Auto-cleanup: when activeNoteId changes away from a note, delete it if body is empty.
  const prevNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevNoteIdRef.current;
    prevNoteIdRef.current = activeNoteId;
    if (!prevId || prevId === activeNoteId) return;
    const prev = notesRef.current.find((n) => n.id === prevId);
    if (prev && prev.body_md.trim() === "") deleteNoteRef.current(prevId);
  }, [activeNoteId]);

  // Auto-cleanup: when activeTaskId changes away from a task, delete it if untouched.
  const prevTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prevId = prevTaskIdRef.current;
    prevTaskIdRef.current = activeTaskId;
    setStatusDropdownOpen(false);
    if (!prevId || prevId === activeTaskId) return;
    const prev = tasksRef.current.find((t) => t.id === prevId);
    if (prev && prev.body_md.trim() === "" && (prev.title === "新しいタスク" || prev.title === "New Task")) deleteTaskRef.current(prevId);
  }, [activeTaskId]);

  // Auto-cleanup on tab switch: covers the case where the active ID itself doesn't change
  // (e.g. clicking the "タスク" tab while a note is selected, without selecting any task).
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    const prevTab = prevTabRef.current;
    prevTabRef.current = activeTab;
    if (prevTab === activeTab) return;
    if (prevTab === "notes") {
      const id = activeNoteIdRef.current;
      if (!id) return;
      const note = notesRef.current.find((n) => n.id === id);
      if (note && note.body_md.trim() === "") deleteNoteRef.current(id);
    } else if (prevTab === "tasks") {
      const id = activeTaskIdRef.current;
      if (!id) return;
      const task = tasksRef.current.find((t) => t.id === id);
      if (task && task.body_md.trim() === "" && (task.title === "新しいタスク" || task.title === "New Task")) deleteTaskRef.current(id);
    }
  }, [activeTab]);

  const handleCreateNote = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: t.defaults.untitledNote,
      body_md: "",
      pinned: false,
      updated_at: new Date().toISOString(),
    };
    setActiveNote(note.id);
    setActiveTask(null);
    setActiveTab("notes");
    setIsEditing(true);
    saveNote(note, userId);
  }, [userId, saveNote, setActiveNote, setActiveTask, setActiveTab]);

  const handleCreateTask = useCallback(() => {
    const task: Task = {
      id: crypto.randomUUID(),
      title: t.defaults.newTask,
      body_md: "",
      due_date: null,
      status: "Todo",
      pinned: false,
      updated_at: new Date().toISOString(),
    };
    setActiveTask(task.id);
    setActiveNote(null);
    setActiveTab("tasks");
    setIsEditing(false);
    saveTask(task, userId);
  }, [userId, saveTask, setActiveTask, setActiveNote, setActiveTab]);

  const handleEditorChange = useCallback(
    (value: string) => {
      if (activeTab === "notes") {
        if (!activeNoteId) return;
        const prev = notes.find((n) => n.id === activeNoteId);
        const note: Note = {
          id: activeNoteId,
          title: extractTitle(value),
          body_md: value,
          pinned: prev?.pinned ?? false,
          updated_at: new Date().toISOString(),
        };
        saveNote(note, userId);
      } else if (activeTab === "tasks") {
        if (!activeTaskId) return;
        const task = tasks.find((t) => t.id === activeTaskId);
        if (!task) return;
        const firstLine = value.split("\n").find((l) => l.trim());
        const title = firstLine?.replace(/^#{1,6}\s+/, "").trim() || task.title;
        const updated: Task = {
          ...task,
          title,
          body_md: value,
          updated_at: new Date().toISOString(),
        };
        saveTask(updated, userId);
      }
    },
    [activeTab, activeNoteId, activeTaskId, tasks, userId, saveNote, saveTask]
  );

  const handleTaskDueDateChange = useCallback(
    (dueDate: string | null) => {
      if (!activeTaskId) return;
      const task = tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      saveTask(
        { ...task, due_date: dueDate || null, updated_at: new Date().toISOString() },
        userId
      );
    },
    [activeTaskId, tasks, userId, saveTask]
  );

  // Navigate items with ⌘↑/↓
  const handlePrevItem = useCallback(() => {
    setIsEditing(false);
    if (activeTab === "notes") {
      const idx = notes.findIndex((n) => n.id === activeNoteId);
      if (idx > 0) { setActiveNote(notes[idx - 1].id); ensureNoteBodyMd(notes[idx - 1].id, userId ?? undefined); }
    } else if (activeTab === "tasks") {
      const idx = tasks.findIndex((t) => t.id === activeTaskId);
      if (idx > 0) { setActiveTask(tasks[idx - 1].id); ensureTaskBodyMd(tasks[idx - 1].id, userId ?? undefined); }
    }
  }, [activeTab, notes, activeNoteId, setActiveNote, tasks, activeTaskId, setActiveTask, ensureNoteBodyMd, ensureTaskBodyMd, userId]);

  const handleNextItem = useCallback(() => {
    setIsEditing(false);
    if (activeTab === "notes") {
      const idx = notes.findIndex((n) => n.id === activeNoteId);
      if (idx < notes.length - 1) { setActiveNote(notes[idx + 1].id); ensureNoteBodyMd(notes[idx + 1].id, userId ?? undefined); }
    } else if (activeTab === "tasks") {
      const idx = tasks.findIndex((t) => t.id === activeTaskId);
      if (idx < tasks.length - 1) { setActiveTask(tasks[idx + 1].id); ensureTaskBodyMd(tasks[idx + 1].id, userId ?? undefined); }
    }
  }, [activeTab, notes, activeNoteId, setActiveNote, tasks, activeTaskId, setActiveTask, ensureNoteBodyMd, ensureTaskBodyMd, userId]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setIsEditing(false);
      setActiveNote(id);
      setActiveTab("notes");
      ensureNoteBodyMd(id, userId ?? undefined);
    },
    [setActiveNote, setActiveTab, ensureNoteBodyMd, userId]
  );

  const handleSelectTask = useCallback(
    (id: string) => {
      setIsEditing(false);
      setActiveTask(id);
      setActiveTab("tasks");
      ensureTaskBodyMd(id, userId ?? undefined);
    },
    [setActiveTask, setActiveTab, ensureTaskBodyMd, userId]
  );

  const handleStorageModeChange = useCallback(
    (mode: StorageMode) => {
      if (onStorageModeChange) {
        onStorageModeChange(mode);
      } else {
        setConfig({ storageMode: mode });
        addToast("info", t.toasts.restartRequired);
      }
    },
    [onStorageModeChange, addToast]
  );

  const handleShowNotes = useCallback(() => {
    setActiveTab("notes");
  }, [setActiveTab]);

  const handleShowTasks = useCallback(() => {
    setActiveTab("tasks");
  }, [setActiveTab]);

  const handleShowExpenses = useCallback(() => {
    setActiveTab("expenses");
  }, [setActiveTab]);

  const handleDeleteNote = useCallback(
    (id: string) => {
      setConfirmDelete({ type: "note", id });
    },
    []
  );

  const handleDeleteTask = useCallback(
    (id: string) => {
      setConfirmDelete({ type: "task", id });
    },
    []
  );

  const handleConfirmDelete = useCallback(() => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "note") {
      deleteNote(confirmDelete.id);
    } else {
      deleteTask(confirmDelete.id);
    }
    setConfirmDelete(null);
  }, [confirmDelete, deleteNote, deleteTask]);

  const handleDeleteNotes = useCallback(
    (ids: string[]) => {
      deleteNotesBatch(ids);
    },
    [deleteNotesBatch]
  );

  const handleDeleteTasks = useCallback(
    (ids: string[]) => {
      deleteTasksBatch(ids);
    },
    [deleteTasksBatch]
  );

  const handleSelectByIndex = useCallback(
    (index: number) => {
      setIsEditing(false);
      if (activeTab === "notes") {
        const note = notes[index];
        if (note) setActiveNote(note.id);
      } else {
        const ordered = groupTasks(tasks).flatMap((g) => g.tasks);
        const task = ordered[index];
        if (task) setActiveTask(task.id);
      }
    },
    [activeTab, notes, tasks, setActiveNote, setActiveTask]
  );

  const handleEnterEditor = useCallback(() => {
    const hasContent =
      (activeTab === "notes" && selectedNote) ||
      (activeTab === "tasks" && selectedTask);
    if (hasContent) setIsEditing(true);
  }, [activeTab, selectedNote, selectedTask]);

  const handleExitEditor = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (activeTab === "notes" && activeNoteId) {
      handleDeleteNote(activeNoteId);
    } else if (activeTab === "tasks" && activeTaskId) {
      handleDeleteTask(activeTaskId);
    }
  }, [activeTab, activeNoteId, activeTaskId, handleDeleteNote, handleDeleteTask]);

  const handleConfirmConvert = useCallback(() => {
    if (!confirmConvert) return;
    if (confirmConvert.type === "note") {
      const note = notes.find((n) => n.id === confirmConvert.id);
      if (note) {
        const task: Task = {
          id: crypto.randomUUID(),
          title: note.title || extractTitle(note.body_md),
          body_md: note.body_md,
          due_date: null,
          status: "Todo",
          pinned: false,
          updated_at: new Date().toISOString(),
        };
        saveTask(task, userId);
        deleteNote(note.id);
        setActiveTask(task.id);
        setActiveNote(null);
        setActiveTab("tasks");
        setIsEditing(false);
        addToast("success", t.toasts.noteToTask);
      }
    } else {
      const task = tasks.find((t) => t.id === confirmConvert.id);
      if (task) {
        const note: Note = {
          id: crypto.randomUUID(),
          title: task.title,
          body_md: task.body_md,
          pinned: false,
          updated_at: new Date().toISOString(),
        };
        saveNote(note, userId);
        deleteTask(task.id);
        setActiveNote(note.id);
        setActiveTask(null);
        setActiveTab("notes");
        setIsEditing(false);
        addToast("success", t.toasts.taskToNote);
      }
    }
    setConfirmConvert(null);
  }, [confirmConvert, notes, tasks, userId, saveNote, saveTask, deleteNote, deleteTask, setActiveNote, setActiveTask, setActiveTab, addToast]);

  const keyboardActions = useMemo(
    () => ({
      onNewNote: handleCreateNote,
      onNewTask: handleCreateTask,
      onPrevItem: handlePrevItem,
      onNextItem: handleNextItem,
      onCycleTheme: cycleTheme,
      onSelectByIndex: handleSelectByIndex,
      onEnterEditor: handleEnterEditor,
      onDeleteSelected: handleDeleteSelected,
      onToggleSidebar: toggleSidebar,
      sidebarToggleShortcut,
    }),
    [handleCreateNote, handleCreateTask, handlePrevItem, handleNextItem, cycleTheme, handleSelectByIndex, handleEnterEditor, handleDeleteSelected, toggleSidebar, sidebarToggleShortcut]
  );

  useKeyboard(keyboardActions);

  return (
    <div className={styles.app}>
      <ResizeHandles />
      {/* Titlebar */}
      <div data-tauri-drag-region className={styles.titlebar}>
        <div className={styles.titlebarLeft}>
          <FloteLogo size={18} />
          <span className={styles.titleLabel}>Flote</span>
          {storageMode === "local" && (
            <span className={styles.storageLabel}>local</span>
          )}
        </div>
        <div className={styles.titlebarRight}>
          <button
            className={`${styles.pinBtn} ${pinned ? styles.pinBtnActive : ""}`}
            onClick={() => setPinned((p) => !p)}
            title={pinned ? t.titlebar.unpin : t.titlebar.pin}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Full-width tab bar */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "notes" ? styles.tabActive : ""}`}
          onClick={handleShowNotes}
        >
          {t.tabs.notes} <span className={styles.tabKbd}>⌘1</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === "tasks" ? styles.tabActive : ""}`}
          onClick={handleShowTasks}
        >
          {t.tabs.tasks} <span className={styles.tabKbd}>⌘2</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === "expenses" ? styles.tabActive : ""}`}
          onClick={handleShowExpenses}
        >
          {t.tabs.expenses} <span className={styles.tabKbd}>⌘3</span>
        </button>
        {activeTab !== "expenses" && (
          <button
            className={styles.sidebarCollapseBtn}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? t.sidebar.expand : t.sidebar.collapse}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        )}
      </div>

      {/* Main area */}
      <div className={styles.main}>
        {/* Expenses: full width */}
        {activeTab === "expenses" && (
          <div className={styles.expensesPane}>
            <ExpensePanel userId={userId} />
          </div>
        )}

        {/* Notes / Tasks: sidebar + editor */}
        {activeTab !== "expenses" && (
          <>
            {!sidebarCollapsed && (
              <div className={styles.sidebar} style={{ width: activeTab === "notes" ? notesSidebarWidth : tasksSidebarWidth }}>
                <div className={styles.sidebarList}>
                  {activeTab === "notes" && (
                    <NoteList
                      notes={notes}
                      activeNoteId={activeNoteId}
                      activeTag={activeNoteTag}
                      onSelect={(id) => { setIsEditing(false); setActiveNote(id); }}
                      onDelete={handleDeleteNote}
                      onDeleteMultiple={handleDeleteNotes}
                      onNew={handleCreateNote}
                      onTagFilter={setActiveNoteTag}
                      onTogglePin={(id) => toggleNotePin(id, userId)}
                    />
                  )}
                  {activeTab === "tasks" && (
                    <TaskList
                      tasks={tasks}
                      activeTaskId={activeTaskId}
                      activeTag={activeTaskTag}
                      onUpdateStatus={(id, status) => updateStatus(id, status, userId)}
                      onDelete={handleDeleteTask}
                      onDeleteMultiple={handleDeleteTasks}
                      onAddTask={handleCreateTask}
                      onSelectTask={handleSelectTask}
                      onTagFilter={setActiveTaskTag}
                      onTogglePin={(id) => toggleTaskPin(id, userId)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Drag-to-resize divider */}
            {!sidebarCollapsed && (
              <div className={styles.resizeDivider} onMouseDown={handleDividerMouseDown} />
            )}

            {/* Editor area */}
            <div className={styles.editorArea}>
          {/* Reopen button shown when sidebar is collapsed */}
          {sidebarCollapsed && (
            <button
              className={styles.sidebarReopenBtn}
              onClick={toggleSidebar}
              title={t.sidebar.expand}
            >
              ›
            </button>
          )}
          {activeTab === "notes" && selectedNote ? (
            <div className={styles.noteDetail}>
              <div className={styles.noteDetailHeader}>
                <button
                  className={`${styles.convertBtn} ${styles.convertBtnNote}`}
                  data-tooltip={t.confirm.convertToTask}
                  onClick={() => setConfirmConvert({ type: "note", id: selectedNote.id })}
                >
                  ↻
                </button>
              </div>
              {extractTags(selectedNote.body_md).length > 0 && (
                <div className={styles.noteTags}>
                  {extractTags(selectedNote.body_md).map((tag) => (
                    <button
                      key={tag}
                      className={`${styles.noteTag} ${activeNoteTag === tag ? styles.noteTagActive : ""}`}
                      onClick={() => {
                        setActiveNoteTag(activeNoteTag === tag ? null : tag);
                        setActiveTab("notes");
                        setSidebarCollapsed(false);
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
              <div
                className={styles.editorWrap}
                onDoubleClick={() => setIsEditing(true)}
              >
                <Editor
                  docId={selectedNote.id}
                  value={selectedNote.body_md}
                  onChange={handleEditorChange}
                  editing={isEditing}
                  onExitEdit={handleExitEditor}
                  editorTheme={activeEditorTheme}
                  vimMode={vimMode}
                  placeholderText={t.editor.editorPlaceholder}
                  emptyNoteText={t.editor.emptyNote}
                />
              </div>
            </div>
          ) : activeTab === "tasks" && selectedTask ? (
            <div className={styles.taskDetail}>
              <div className={styles.taskDetailHeader}>
                <div className={styles.statusPickerWrap} data-status-dropdown="">
                  <button
                    className={styles.taskDetailStatusBtn}
                    onClick={() => setStatusDropdownOpen((v) => !v)}
                  >
                    <span
                      className={styles.statusDot}
                      style={{ backgroundColor: STATUS_COLORS[selectedTask.status] }}
                    />
                    <span
                      className={styles.taskDetailStatus}
                      style={{ color: STATUS_COLORS[selectedTask.status] }}
                    >
                      {t.taskStatus.statuses[selectedTask.status]}
                    </span>
                    <span className={styles.statusChevron}>▾</span>
                  </button>
                  {statusDropdownOpen && (
                    <div className={styles.statusDropdown}>
                      {(Object.keys(STATUS_COLORS) as TaskStatus[]).map((s) => (
                        <button
                          key={s}
                          className={`${styles.statusDropdownItem} ${selectedTask.status === s ? styles.statusDropdownItemActive : ""}`}
                          onClick={() => {
                            updateStatus(selectedTask.id, s, userId);
                            setStatusDropdownOpen(false);
                          }}
                        >
                          <span className={styles.statusDot} style={{ backgroundColor: STATUS_COLORS[s] }} />
                          {t.taskStatus.statuses[s]}
                          {selectedTask.status === s && <span className={styles.statusCheck}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <DatePicker
                  value={selectedTask.due_date}
                  onChange={handleTaskDueDateChange}
                  placeholder={t.taskStatus.setDueDate}
                />
                <button
                  className={`${styles.convertBtn} ${styles.convertBtnTask}`}
                  data-tooltip={t.confirm.convertToNote}
                  onClick={() => setConfirmConvert({ type: "task", id: selectedTask.id })}
                >
                  ↻
                </button>
              </div>
              {extractTags(selectedTask.body_md).length > 0 && (
                <div className={styles.noteTags}>
                  {extractTags(selectedTask.body_md).map((tag) => (
                    <button
                      key={tag}
                      className={`${styles.noteTag} ${activeTaskTag === tag ? styles.noteTagActive : ""}`}
                      onClick={() =>
                        setActiveTaskTag(activeTaskTag === tag ? null : tag)
                      }
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
              <div
                className={styles.editorWrap}
                onDoubleClick={() => setIsEditing(true)}
              >
                <Editor
                  docId={selectedTask.id}
                  value={selectedTask.body_md}
                  onChange={handleEditorChange}
                  editing={isEditing}
                  onExitEdit={handleExitEditor}
                  editorTheme={activeEditorTheme}
                  vimMode={vimMode}
                  placeholderText={t.editor.editorPlaceholder}
                  emptyNoteText={t.editor.emptyNote}
                />
              </div>
            </div>
          ) : (
            <div className={styles.editorPlaceholder}>
              {activeTab === "notes"
                ? t.editor.notePlaceholder
                : t.editor.taskPlaceholder}
            </div>
          )}
            </div>
          </>
        )}
      </div>

      {/* Statusbar */}
      <div className={styles.statusbar}>
        <div className={styles.statusLeft}>
          {activeTab === "notes" && selectedNote && (
            <>
              <span>{wordCount} words</span>
              <span>{isEditing ? t.editor.editing : t.editor.preview}</span>
            </>
          )}
          {activeTab === "tasks" && selectedTask && (
            <>
              <span>{t.taskStatus.statuses[selectedTask.status]}</span>
              {selectedTask.due_date && (
                <span>{t.taskStatus.dueLabel(selectedTask.due_date)}</span>
              )}
              <span>{isEditing ? t.editor.editing : t.editor.preview}</span>
            </>
          )}
        </div>
        <div className={styles.statusRight}>
          {overdueCount > 0 && (
            <span className={styles.overdueBadge}>
              {t.taskStatus.overdueBadge(overdueCount)}
            </span>
          )}
          <button
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            title={`${t.settings.title} (⌘,)`}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Command Palette overlay */}
      {isCommandPaletteOpen && (
        <CommandPalette
          notes={notes}
          tasks={tasks}
          onSelectNote={handleSelectNote}
          onSelectTask={handleSelectTask}
          onNewNote={handleCreateNote}
          onNewTask={handleCreateTask}
          onCycleTheme={cycleTheme}
          onShowNotes={handleShowNotes}
          onShowTasks={handleShowTasks}
          onFilterByTag={(tag) => {
            setActiveNoteTag(tag);
            setSidebarCollapsed(false);
          }}
          onSync={handleSync}
          canSync={storageMode !== "local"}
        />
      )}

      {/* Settings overlay */}
      {isSettingsOpen && (
        <Settings
          currentMode={storageMode}
          onClose={() => setSettingsOpen(false)}
          onStorageModeChange={handleStorageModeChange}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.type === "note" ? t.confirm.deleteNote : t.confirm.deleteTask}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmConvert && (
        <ConfirmDialog
          message={confirmConvert.type === "note" ? t.confirm.convertNoteToTask : t.confirm.convertTaskToNote}
          confirmLabel={t.confirm.convert}
          onConfirm={handleConfirmConvert}
          onCancel={() => setConfirmConvert(null)}
        />
      )}

      {/* Toast */}
      <ToastContainer />
    </div>
  );
}

/* ─── App (entry) ─── */

function App() {
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [schemaStatus, setSchemaStatus] = useState<"unchecked" | "ok" | "not_initialized">("unchecked");
  const { session, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const supabaseReady = useUIStore((s) => s.supabaseReady);
  const setSupabaseReady = useUIStore((s) => s.setSupabaseReady);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const t = useT();

  const initNoteStore = useNoteStore((s) => s.initStore);
  const initTaskStore = useTaskStore((s) => s.initStore);
  const initExpenseStore = useExpenseStore((s) => s.initStore);

  useTheme();

  // Sync tray menu labels whenever language changes
  useEffect(() => {
    invoke("update_tray_menu", {
      openLabel: t.tray.open,
      quitLabel: t.tray.quit,
    }).catch(() => {});
  }, [t]);

  // Load config on mount — initialize Supabase based on storage mode
  useEffect(() => {
    getConfig().then(async (config) => {
      if (config.language) setLanguage(config.language);
      let mode = config.storageMode;

      if (mode === "supabase") {
        if (envSupabaseUrl && envSupabaseKey) {
          reinitSupabase(envSupabaseUrl, envSupabaseKey);
          setSupabaseReady(true);
        } else {
          mode = "local"; // env vars not available → fallback
        }
      } else if (mode === "selfhost") {
        if (config.customSupabaseUrl && config.customSupabaseAnonKey) {
          reinitSupabase(config.customSupabaseUrl, config.customSupabaseAnonKey);
          setSupabaseReady(true);
        } else {
          mode = "local"; // custom config not set → fallback
        }
      }

      if (mode !== config.storageMode) setConfig({ storageMode: mode });

      setStorageMode(mode);

      if (navigator.userAgent.includes("Mac")) {
        invoke("set_dock_visible", { visible: !config.hideDockIcon });
      }

      if (config.globalShortcut) {
        invoke("update_global_shortcut", { shortcut: config.globalShortcut }).catch(() => {});
      }
      if (config.captureShortcut) {
        invoke("update_capture_shortcut", { shortcut: config.captureShortcut }).catch(() => {});
      }

      if (mode === "local") await initDb();

      const noteRepo = createNoteRepository(mode);
      const taskRepo = createTaskRepository(mode);
      const transactionRepo = createTransactionRepository(mode);
      initNoteStore(noteRepo);
      initTaskStore(taskRepo);
      initExpenseStore(transactionRepo);

      setLoading(false);
    });
  }, [initNoteStore, initTaskStore]);

  // schema check after login (selfhost only — developer's cloud is already set up)
  useEffect(() => {
    if (!session || storageMode !== "selfhost") return;
    if (schemaStatus !== "unchecked") return;
    checkSchema(getSupabase()).then(setSchemaStatus);
  }, [session, storageMode, schemaStatus]);

  const handleSchemaRetry = async () => {
    const status = await checkSchema(getSupabase());
    setSchemaStatus(status);
  };

  const handleStorageModeChange = useCallback(async (mode: StorageMode) => {
    await setConfig({ storageMode: mode });
    initNoteStore(createNoteRepository(mode));
    initTaskStore(createTaskRepository(mode));
    initExpenseStore(createTransactionRepository(mode));
    setStorageMode(mode);
    if (mode === "selfhost") setSchemaStatus("unchecked");
  }, [initNoteStore, initTaskStore, initExpenseStore]);

  const handleUseLocal = useCallback(() => handleStorageModeChange("local"), [handleStorageModeChange]);

  if (loading || storageMode === null) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.loadingContent}>{t.loading}</div>
      </div>
    );
  }

  // Local mode: no auth needed — cloud/selfhost login is done inline via Settings
  if (storageMode === "local") {
    return (
      <MainApp
        storageMode={storageMode}
        onStorageModeChange={handleStorageModeChange}
      />
    );
  }

  // Cloud mode: need config
  if (!supabaseReady) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.supabaseWarning}>
          <div className={styles.warningBox}>
            <p className={styles.warningTitle}>{t.cloud.notConfiguredTitle}</p>
            <p>{t.cloud.notConfiguredDesc}</p>
            <p>
              <code className={styles.warningCode}>
                apps/desktop/.env.local
              </code>{" "}
              {t.cloud.notConfiguredHint}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Auth loading
  if (authLoading) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.loadingContent}>{t.loading}</div>
      </div>
    );
  }

  // Not logged in → show login with local option
  if (!session) {
    return (
      <Auth
        onSignIn={signIn}
        onSignUp={signUp}
        onUseLocal={handleUseLocal}
      />
    );
  }

  // Schema not initialized → show setup screen
  if (schemaStatus === "not_initialized") {
    return (
      <SchemaSetup
        onRetry={handleSchemaRetry}
        onSignOut={async () => {
          await signOut();
          setSchemaStatus("unchecked");
        }}
      />
    );
  }

  // Logged in
  return (
    <MainApp
      userId={session.user.id}
      storageMode={storageMode}
      onSignOut={signOut}
      onStorageModeChange={handleStorageModeChange}
    />
  );
}

export default App;
