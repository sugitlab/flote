import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Note, Task, StorageMode } from "@flote/types";
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
import ToastContainer from "./components/Toast";
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
  const { tasks, fetchTasks, saveTask, deleteTask, toggleDone } =
    useTaskStore();

  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const addToast = useUIStore((s) => s.addToast);

  const [filter, setFilter] = useState("");
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  const { cycleTheme } = useTheme();

  const selectedNote = notes.find((n) => n.id === activeNoteId) ?? null;
  const wordCount = selectedNote ? countWords(selectedNote.body_md) : 0;
  const overdueCount = countOverdue(tasks);

  useRealtime(userId, storageMode);
  useBadge();

  useEffect(() => {
    fetchNotes(userId);
    fetchTasks(userId);
  }, [userId, fetchNotes, fetchTasks]);

  const handleCreateNote = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "無題のノート",
      body_md: "",
      updated_at: new Date().toISOString(),
    };
    setActiveNote(note.id);
    setActiveTab("notes");
    saveNote(note, userId);
  }, [userId, saveNote, setActiveNote, setActiveTab]);

  const handleCreateTask = useCallback(() => {
    setActiveTab("tasks");
    // Focus the task input (it's inside TaskList)
  }, [setActiveTab]);

  const handleEditorChange = useCallback(
    (value: string) => {
      if (!activeNoteId) return;
      const note: Note = {
        id: activeNoteId,
        title: extractTitle(value),
        body_md: value,
        updated_at: new Date().toISOString(),
      };
      saveNote(note, userId);
    },
    [activeNoteId, userId, saveNote]
  );

  const handleAddTask = useCallback(
    (title: string, dueDate: string | null) => {
      const task: Task = {
        id: crypto.randomUUID(),
        title,
        due_date: dueDate,
        remind_at: null,
        done: false,
        updated_at: new Date().toISOString(),
      };
      saveTask(task, userId);
    },
    [userId, saveTask]
  );

  // Navigate items with ⌘↑/↓
  const handlePrevItem = useCallback(() => {
    if (activeTab === "notes") {
      const idx = notes.findIndex((n) => n.id === activeNoteId);
      if (idx > 0) setActiveNote(notes[idx - 1].id);
    }
  }, [activeTab, notes, activeNoteId, setActiveNote]);

  const handleNextItem = useCallback(() => {
    if (activeTab === "notes") {
      const idx = notes.findIndex((n) => n.id === activeNoteId);
      if (idx < notes.length - 1) setActiveNote(notes[idx + 1].id);
    }
  }, [activeTab, notes, activeNoteId, setActiveNote]);

  const handleSelectNote = useCallback(
    (id: string) => {
      setActiveNote(id);
      setActiveTab("notes");
    },
    [setActiveNote, setActiveTab]
  );

  const handleSelectTask = useCallback(
    (id: string) => {
      setActiveTab("tasks");
      // Could scroll to task if needed
      void id;
    },
    [setActiveTab]
  );

  const handleStorageModeChange = useCallback(
    (mode: StorageMode) => {
      setConfig({ storageMode: mode });
      addToast("info", "設定を反映するにはアプリを再起動してください");
    },
    [addToast]
  );

  const keyboardActions = useMemo(
    () => ({
      onNewNote: handleCreateNote,
      onNewTask: handleCreateTask,
      onPrevItem: handlePrevItem,
      onNextItem: handleNextItem,
      onCycleTheme: cycleTheme,
      filterInputRef,
    }),
    [handleCreateNote, handleCreateTask, handlePrevItem, handleNextItem, cycleTheme]
  );

  useKeyboard(keyboardActions);

  // Filtered items
  const filteredNotes = filter
    ? notes.filter((n) => n.title.toLowerCase().includes(filter.toLowerCase()))
    : notes;

  const filteredTasks = filter
    ? tasks.filter((t) => t.title.toLowerCase().includes(filter.toLowerCase()))
    : tasks;

  return (
    <div className={styles.app}>
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
              ノート
            </button>
            <button
              className={`${styles.tab} ${activeTab === "tasks" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("tasks")}
            >
              タスク
            </button>
          </div>

          <div className={styles.filterWrap}>
            <input
              ref={filterInputRef}
              className={styles.filterInput}
              placeholder="フィルター (⌘F)"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
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
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`${styles.noteItem} ${activeNoteId === note.id ? styles.noteItemActive : ""}`}
                    onClick={() => setActiveNote(note.id)}
                  >
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
                        deleteNote(note.id);
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
                tasks={filteredTasks}
                onToggleDone={(id) => toggleDone(id, userId)}
                onDelete={deleteTask}
                onAddTask={handleAddTask}
              />
            )}
          </div>
        </div>

        {/* Editor area */}
        <div className={styles.editorArea}>
          {selectedNote ? (
            <Editor value={selectedNote.body_md} onChange={handleEditorChange} />
          ) : (
            <div className={styles.editorPlaceholder}>
              ノートを選択するか、⌘N で新しいノートを作成
            </div>
          )}
        </div>
      </div>

      {/* Statusbar */}
      <div className={styles.statusbar}>
        <div className={styles.statusLeft}>
          {selectedNote && (
            <>
              <span>{wordCount} words</span>
              <span>Markdown</span>
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
