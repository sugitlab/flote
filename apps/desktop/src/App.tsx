import { useState, useEffect, useCallback, useMemo } from "react";
import type { Note, Task, StorageMode } from "@flote/types";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
import TaskList from "./components/TaskList";
import Settings from "./components/Settings";
import CommandPalette from "./components/CommandPalette";
import ConfirmDialog from "./components/ConfirmDialog";
import ResizeHandles from "./components/ResizeHandles";
import ToastContainer from "./components/Toast";
import { relativeDate } from "./utils/date";
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
}: {
  userId?: string;
  storageMode: StorageMode;
  onSignOut?: () => void;
}) {
  const {
    notes,
    activeNoteId,
    fetchNotes,
    saveNote,
    deleteNote,
    setActiveNote,
  } = useNoteStore();
  const {
    tasks,
    activeTaskId,
    fetchTasks,
    saveTask,
    deleteTask,
    toggleDone,
    setActiveTask,
  } = useTaskStore();

  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const addToast = useUIStore((s) => s.addToast);

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "note" | "task"; id: string } | null>(null);

  const { cycleTheme } = useTheme();

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
      remind_at: null,
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
        const updated: Task = {
          ...task,
          body_md: value,
          updated_at: new Date().toISOString(),
        };
        saveTask(updated, userId);
      }
    },
    [activeTab, activeNoteId, activeTaskId, tasks, userId, saveNote, saveTask]
  );

  const handleTaskTitleChange = useCallback(
    (title: string) => {
      if (!activeTaskId) return;
      const task = tasks.find((t) => t.id === activeTaskId);
      if (!task) return;
      saveTask({ ...task, title, updated_at: new Date().toISOString() }, userId);
    },
    [activeTaskId, tasks, userId, saveTask]
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
    }
  }, [activeTab, notes, activeNoteId, setActiveNote]);

  const handleNextItem = useCallback(() => {
    setIsEditing(false);
    if (activeTab === "notes") {
      const idx = notes.findIndex((n) => n.id === activeNoteId);
      if (idx < notes.length - 1) setActiveNote(notes[idx + 1].id);
    }
  }, [activeTab, notes, activeNoteId, setActiveNote]);

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
      setConfig({ storageMode: mode });
      addToast("info", "設定を反映するにはアプリを再起動してください");
    },
    [addToast]
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

  const handleSelectByIndex = useCallback(
    (index: number) => {
      setIsEditing(false);
      if (activeTab === "notes") {
        const note = notes[index];
        if (note) setActiveNote(note.id);
      } else {
        const task = tasks[index];
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

  const keyboardActions = useMemo(
    () => ({
      onNewNote: handleCreateNote,
      onNewTask: handleCreateTask,
      onPrevItem: handlePrevItem,
      onNextItem: handleNextItem,
      onCycleTheme: cycleTheme,
      onSelectByIndex: handleSelectByIndex,
      onEnterEditor: handleEnterEditor,
    }),
    [handleCreateNote, handleCreateTask, handlePrevItem, handleNextItem, cycleTheme, handleSelectByIndex, handleEnterEditor]
  );

  useKeyboard(keyboardActions);

  return (
    <div className={styles.app}>
      <ResizeHandles />
      {/* Titlebar */}
      <div data-tauri-drag-region className={styles.titlebar}>
        <div className={styles.titlebarLeft}>
          <div className={styles.dots}>
            <span className={`${styles.dot} ${styles.dotRed}`} />
            <span className={`${styles.dot} ${styles.dotYellow}`} />
            <span className={`${styles.dot} ${styles.dotGreen}`} />
          </div>
          <span className={styles.titleLabel}>Flote</span>
          {storageMode === "local" && (
            <span className={styles.storageLabel}>local</span>
          )}
        </div>
        <div className={styles.titlebarRight}>
          <span className={styles.kbd}>⌘K</span>
          {onSignOut && (
            <button className={styles.settingsBtn} onClick={onSignOut}>
              ログアウト
            </button>
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
              <>
                <button
                  className={styles.newButton}
                  onClick={handleCreateNote}
                >
                  + 新しいノート
                </button>
                {notes.map((note, idx) => (
                  <div
                    key={note.id}
                    className={`${styles.noteItem} ${activeNoteId === note.id ? styles.noteItemActive : ""}`}
                    onClick={() => { setIsEditing(false); setActiveNote(note.id); }}
                  >
                    {idx < 9 && (
                      <span className={styles.indexBadge}>{idx + 1}</span>
                    )}
                    <div className={styles.noteItemContent}>
                      <div className={styles.noteItemTitle}>{note.title}</div>
                      <div className={styles.noteItemDate}>
                        {relativeDate(note.updated_at)}
                      </div>
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}

            {activeTab === "tasks" && (
              <TaskList
                tasks={tasks}
                activeTaskId={activeTaskId}
                onToggleDone={(id) => toggleDone(id, userId)}
                onDelete={handleDeleteTask}
                onAddTask={handleCreateTask}
                onSelectTask={handleSelectTask}
              />
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className={styles.editorArea}>
          {activeTab === "notes" && selectedNote ? (
            <div
              className={styles.editorWrap}
              onDoubleClick={() => setIsEditing(true)}
            >
              <Editor
                value={selectedNote.body_md}
                onChange={handleEditorChange}
                editing={isEditing}
                onExitEdit={handleExitEditor}
              />
            </div>
          ) : activeTab === "tasks" && selectedTask ? (
            <div className={styles.taskDetail}>
              <div className={styles.taskDetailHeader}>
                <div className={styles.taskDetailTitle}>
                  <input
                    type="checkbox"
                    checked={selectedTask.done}
                    onChange={() => toggleDone(selectedTask.id, userId)}
                    className={styles.taskDetailCheckbox}
                  />
                  <input
                    type="text"
                    value={selectedTask.title}
                    onChange={(e) => handleTaskTitleChange(e.target.value)}
                    className={styles.taskDetailTitleInput}
                  />
                </div>
                <input
                  type="date"
                  value={selectedTask.due_date ?? ""}
                  onChange={(e) => handleTaskDueDateChange(e.target.value)}
                  className={styles.taskDetailDateInput}
                />
              </div>
              <div
                className={styles.editorWrap}
                onDoubleClick={() => setIsEditing(true)}
              >
                <Editor
                  value={selectedTask.body_md}
                  onChange={handleEditorChange}
                  editing={isEditing}
                  onExitEdit={handleExitEditor}
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

      {/* Toast */}
      <ToastContainer />
    </div>
  );
}

/* ─── App (entry) ─── */

function App() {
  const [storageMode, setStorageMode] = useState<StorageMode | null>(null);
  const [loading, setLoading] = useState(true);
  const { session, loading: authLoading, signIn, signUp, signOut } = useAuth();

  const initNoteStore = useNoteStore((s) => s.initStore);
  const initTaskStore = useTaskStore((s) => s.initStore);

  useTheme();

  // Load config on mount
  useEffect(() => {
    getConfig().then((config) => {
      setStorageMode(config.storageMode);

      const noteRepo = createNoteRepository(config.storageMode);
      const taskRepo = createTaskRepository(config.storageMode);
      initNoteStore(noteRepo);
      initTaskStore(taskRepo);

      setLoading(false);
    });
  }, [initNoteStore, initTaskStore]);

  if (loading || storageMode === null) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.loadingContent}>読み込み中...</div>
      </div>
    );
  }

  // Local mode: no auth needed
  if (storageMode === "local") {
    return <MainApp storageMode={storageMode} />;
  }

  // Supabase mode: need config
  if (!supabaseConfigured) {
    return (
      <div className={styles.loading}>
        <div data-tauri-drag-region className={styles.loadingDrag} />
        <div className={styles.supabaseWarning}>
          <div className={styles.warningBox}>
            <p className={styles.warningTitle}>Supabase未設定</p>
            <p>保存先がSupabaseに設定されていますが、接続情報がありません。</p>
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

  // Not logged in
  if (!session) {
    return <Auth onSignIn={signIn} onSignUp={signUp} />;
  }

  // Logged in
  return (
    <MainApp
      userId={session.user.id}
      storageMode={storageMode}
      onSignOut={signOut}
    />
  );
}

export default App;
