import { useState, useEffect, useCallback, useMemo } from "react";
import type { Note, Task, StorageMode } from "@flote/types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  initSupabase,
  createNoteRepository,
  createTaskRepository,
} from "@flote/api-client";
import { getConfig, setConfig } from "./config";
import { useAuth } from "./hooks/useAuth";
import { useRealtime } from "./hooks/useRealtime";
import { useBadge } from "./hooks/useBadge";
import { useTheme } from "./hooks/useTheme";
import { useKeyboard } from "./hooks/useKeyboard";
import { useNoteStore } from "./store/noteStore";
import { useTaskStore } from "./store/taskStore";
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
import styles from "./App.module.css";

// Initialize Supabase client if env vars present
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (supabaseUrl && supabaseKey) {
  initSupabase(supabaseUrl, supabaseKey);
}
const supabaseConfigured = !!supabaseUrl && !!supabaseKey;

function extractTitle(bodyMd: string): string {
  const firstLine = bodyMd.split("\n")[0]?.replace(/^#+\s*/, "").trim();
  return firstLine || "無題のノート";
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

function countOverdue(tasks: Task[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return tasks.filter((t) => !t.done && t.due_date && t.due_date <= today)
    .length;
}

/* ─── MainApp ─── */

function MainApp({
  userId,
  storageMode,
  onSignOut,
  onRequestLogin,
  onStorageModeChange,
}: {
  userId?: string;
  storageMode: StorageMode;
  onSignOut?: () => void;
  onRequestLogin?: () => void;
  onStorageModeChange?: (mode: StorageMode) => void;
}) {
  const {
    notes,
    activeNoteId,
    fetchNotes,
    saveNote,
    deleteNote,
    deleteNotesBatch,
    setActiveNote,
  } = useNoteStore();
  const {
    tasks,
    activeTaskId,
    fetchTasks,
    saveTask,
    deleteTask,
    deleteTasksBatch,
    toggleDone,
    setActiveTask,
  } = useTaskStore();

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
  const uiTheme = useUIStore((s) => s.theme);

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "note" | "task"; id: string } | null>(null);
  const [confirmConvert, setConfirmConvert] = useState<{ type: "note" | "task"; id: string } | null>(null);

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
    fetchNotes(userId);
    fetchTasks(userId);
  }, [userId, fetchNotes, fetchTasks]);

  useEffect(() => {
    getConfig().then((c) => {
      setSearchFullText(c.searchFullText);
      setHideCompletedInSearch(c.hideCompletedInSearch);
      setEditorThemeDark(c.editorThemeDark);
      setEditorThemeLight(c.editorThemeLight);
    });
  }, []);

  // Hide window when it loses focus (if setting enabled)
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged(async ({ payload: focused }) => {
      if (!focused) {
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

  const handleCreateNote = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "無題のノート",
      body_md: "",
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
      title: "新しいタスク",
      body_md: "",
      due_date: null,
      done: false,
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
        const note: Note = {
          id: activeNoteId,
          title: extractTitle(value),
          body_md: value,
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
    (dueDate: string) => {
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
      if (idx > 0) setActiveNote(notes[idx - 1].id);
    } else if (activeTab === "tasks") {
      const idx = tasks.findIndex((t) => t.id === activeTaskId);
      if (idx > 0) setActiveTask(tasks[idx - 1].id);
    }
  }, [activeTab, notes, activeNoteId, setActiveNote, tasks, activeTaskId, setActiveTask]);

  const handleNextItem = useCallback(() => {
    setIsEditing(false);
    if (activeTab === "notes") {
      const idx = notes.findIndex((n) => n.id === activeNoteId);
      if (idx < notes.length - 1) setActiveNote(notes[idx + 1].id);
    } else if (activeTab === "tasks") {
      const idx = tasks.findIndex((t) => t.id === activeTaskId);
      if (idx < tasks.length - 1) setActiveTask(tasks[idx + 1].id);
    }
  }, [activeTab, notes, activeNoteId, setActiveNote, tasks, activeTaskId, setActiveTask]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setIsEditing(false);
      setActiveNote(id);
      setActiveTab("notes");
    },
    [setActiveNote, setActiveTab]
  );

  const handleSelectTask = useCallback(
    (id: string) => {
      setIsEditing(false);
      setActiveTask(id);
      setActiveTab("tasks");
    },
    [setActiveTask, setActiveTab]
  );

  const handleStorageModeChange = useCallback(
    (mode: StorageMode) => {
      if (onStorageModeChange) {
        onStorageModeChange(mode);
      } else {
        setConfig({ storageMode: mode });
        addToast("info", "設定を反映するにはアプリを再起動してください");
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
          done: false,
          updated_at: new Date().toISOString(),
        };
        saveTask(task, userId);
        deleteNote(note.id);
        setActiveTask(task.id);
        setActiveNote(null);
        setActiveTab("tasks");
        setIsEditing(false);
        addToast("success", "ノートをタスクに変換しました");
      }
    } else {
      const task = tasks.find((t) => t.id === confirmConvert.id);
      if (task) {
        const note: Note = {
          id: crypto.randomUUID(),
          title: task.title,
          body_md: task.body_md,
          updated_at: new Date().toISOString(),
        };
        saveNote(note, userId);
        deleteTask(task.id);
        setActiveNote(note.id);
        setActiveTask(null);
        setActiveTab("notes");
        setIsEditing(false);
        addToast("success", "タスクをノートに変換しました");
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
    }),
    [handleCreateNote, handleCreateTask, handlePrevItem, handleNextItem, cycleTheme, handleSelectByIndex, handleEnterEditor, handleDeleteSelected]
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
      </div>

      {/* Main area */}
      <div className={styles.main}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "notes" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("notes")}
            >
              ノート <span className={styles.tabKbd}>⌘1</span>
            </button>
            <button
              className={`${styles.tab} ${activeTab === "tasks" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              タスク <span className={styles.tabKbd}>⌘2</span>
            </button>
          </div>

          <div className={styles.sidebarList}>
            {activeTab === "notes" && (
              <NoteList
                notes={notes}
                activeNoteId={activeNoteId}
                onSelect={(id) => { setIsEditing(false); setActiveNote(id); }}
                onDelete={handleDeleteNote}
                onDeleteMultiple={handleDeleteNotes}
                onNew={handleCreateNote}
              />
            )}

            {activeTab === "tasks" && (
              <TaskList
                tasks={tasks}
                activeTaskId={activeTaskId}
                onToggleDone={(id) => toggleDone(id, userId)}
                onDelete={handleDeleteTask}
                onDeleteMultiple={handleDeleteTasks}
                onAddTask={handleCreateTask}
                onSelectTask={handleSelectTask}
              />
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className={styles.editorArea}>
          {activeTab === "notes" && selectedNote ? (
            <div className={styles.noteDetail}>
              <div className={styles.noteDetailHeader}>
                <button
                  className={`${styles.convertBtn} ${styles.convertBtnNote}`}
                  onClick={() => setConfirmConvert({ type: "note", id: selectedNote.id })}
                >
                  ↻
                </button>
              </div>
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
                />
              </div>
            </div>
          ) : activeTab === "tasks" && selectedTask ? (
            <div className={styles.taskDetail}>
              <div className={styles.taskDetailHeader}>
                <button
                  className={styles.taskDetailStatusBtn}
                  onClick={() => toggleDone(selectedTask.id, userId)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTask.done}
                    readOnly
                    className={styles.taskDetailCheckbox}
                  />
                  <span
                    className={styles.taskDetailStatus}
                    style={{ color: selectedTask.done ? "var(--accent)" : "#f59e0b" }}
                  >
                    {selectedTask.done ? "完了" : "未完了"}
                  </span>
                </button>
                <div className={styles.datePickerWrap}>
                  <span className={styles.taskDetailDateInput}>
                    {selectedTask.due_date || "期日を設定"}
                  </span>
                  <input
                    type="date"
                    value={selectedTask.due_date ?? ""}
                    onChange={(e) => handleTaskDueDateChange(e.target.value)}
                    className={styles.datePickerHidden}
                  />
                </div>
                <button
                  className={`${styles.convertBtn} ${styles.convertBtnTask}`}
                  onClick={() => setConfirmConvert({ type: "task", id: selectedTask.id })}
                >
                  ↻
                </button>
              </div>
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
                />
              </div>
            </div>
          ) : (
            <div className={styles.editorPlaceholder}>
              {activeTab === "notes"
                ? "ノートを選択するか、⌘N で新しいノートを作成"
                : "タスクを選択してメモを編集"}
            </div>
          )}
        </div>
      </div>

      {/* Statusbar */}
      <div className={styles.statusbar}>
        <div className={styles.statusLeft}>
          {activeTab === "notes" && selectedNote && (
            <>
              <span>{wordCount} words</span>
              <span>{isEditing ? "編集" : "プレビュー"}</span>
            </>
          )}
          {activeTab === "tasks" && selectedTask && (
            <>
              <span>{selectedTask.done ? "完了" : "未完了"}</span>
              {selectedTask.due_date && (
                <span>期限: {selectedTask.due_date}</span>
              )}
              <span>{isEditing ? "編集" : "プレビュー"}</span>
            </>
          )}
        </div>
        <div className={styles.statusRight}>
          {overdueCount > 0 && (
            <span className={styles.overdueBadge}>
              {overdueCount} 期限切れ
            </span>
          )}
          <button
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            title="設定 (⌘,)"
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
        />
      )}

      {/* Settings overlay */}
      {isSettingsOpen && (
        <Settings
          currentMode={storageMode}
          onClose={() => setSettingsOpen(false)}
          onStorageModeChange={handleStorageModeChange}
          onRequestLogin={onRequestLogin ? () => { setSettingsOpen(false); onRequestLogin(); } : undefined}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.type === "note" ? "このノートを削除しますか？" : "このタスクを削除しますか？"}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmConvert && (
        <ConfirmDialog
          message={confirmConvert.type === "note" ? "このノートをタスクに変換しますか？元のノートは削除されます。" : "このタスクをノートに変換しますか？元のタスクは削除されます。"}
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
  const [showLoginForCloud, setShowLoginForCloud] = useState(false);
  const { session, loading: authLoading, signIn, signUp, signOut } = useAuth();

  const initNoteStore = useNoteStore((s) => s.initStore);
  const initTaskStore = useTaskStore((s) => s.initStore);

  useTheme();

  // Load config on mount
  useEffect(() => {
    getConfig().then((config) => {
      // supabase未設定なのにcloudモードになっている場合はlocalにフォールバック
      const mode =
        config.storageMode === "supabase" && !supabaseConfigured
          ? "local"
          : config.storageMode;
      if (mode !== config.storageMode) setConfig({ storageMode: mode });

      setStorageMode(mode);

      invoke("set_dock_visible", { visible: !config.hideDockIcon });

      const noteRepo = createNoteRepository(mode);
      const taskRepo = createTaskRepository(mode);
      initNoteStore(noteRepo);
      initTaskStore(taskRepo);

      setLoading(false);
    });
  }, [initNoteStore, initTaskStore]);

  const handleUseLocal = async () => {
    await setConfig({ storageMode: "local" });
    const noteRepo = createNoteRepository("local");
    const taskRepo = createTaskRepository("local");
    initNoteStore(noteRepo);
    initTaskStore(taskRepo);
    setStorageMode("local");
    setShowLoginForCloud(false);
  };

  const handleStorageModeChange = useCallback(async (mode: StorageMode) => {
    if (mode === "local") {
      await handleUseLocal();
      return;
    }
    // supabase への切り替え（StorageTab経由 — ログイン済みの場合のみ呼ばれる）
    if (!supabaseConfigured) return;
    await setConfig({ storageMode: "supabase" });
    const noteRepo = createNoteRepository("supabase");
    const taskRepo = createTaskRepository("supabase");
    initNoteStore(noteRepo);
    initTaskStore(taskRepo);
    setStorageMode("supabase");
  }, [initNoteStore, initTaskStore]);

  if (loading || storageMode === null) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.loadingContent}>読み込み中...</div>
      </div>
    );
  }

  // Local mode: no auth needed (but user may want to log in for cloud)
  if (storageMode === "local") {
    if (showLoginForCloud && supabaseConfigured) {
      return (
        <Auth
          onSignIn={async (email, password) => {
            await signIn(email, password);
            setShowLoginForCloud(false);
            await setConfig({ storageMode: "supabase" });
            setStorageMode("supabase");
            const noteRepo = createNoteRepository("supabase");
            const taskRepo = createTaskRepository("supabase");
            initNoteStore(noteRepo);
            initTaskStore(taskRepo);
          }}
          onSignUp={async (email, password) => {
            await signUp(email, password);
            setShowLoginForCloud(false);
            await setConfig({ storageMode: "supabase" });
            setStorageMode("supabase");
            const noteRepo = createNoteRepository("supabase");
            const taskRepo = createTaskRepository("supabase");
            initNoteStore(noteRepo);
            initTaskStore(taskRepo);
          }}
          onUseLocal={() => setShowLoginForCloud(false)}
        />
      );
    }
    return (
      <MainApp
        storageMode={storageMode}
        onRequestLogin={() => setShowLoginForCloud(true)}
        onStorageModeChange={handleStorageModeChange}
      />
    );
  }

  // Cloud mode: need config
  if (!supabaseConfigured) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.supabaseWarning}>
          <div className={styles.warningBox}>
            <p className={styles.warningTitle}>クラウド未設定</p>
            <p>保存先がクラウドに設定されていますが、接続情報がありません。</p>
            <p>
              <code className={styles.warningCode}>
                apps/desktop/.env.local
              </code>{" "}
              に接続情報を設定してください。
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
        <div className={styles.loadingContent}>読み込み中...</div>
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
