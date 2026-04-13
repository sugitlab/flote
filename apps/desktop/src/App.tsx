import { useState, useEffect, useCallback } from "react";
import type { Note, Task } from "@flote/types";
import {
  getNotes,
  saveNote,
  deleteNote as deleteNoteStorage,
  getTasks,
  saveTask,
  deleteTask as deleteTaskStorage,
} from "@flote/api-client/src/local-storage";
import Editor from "./components/Editor";

function generateId(): string {
  return crypto.randomUUID();
}

function extractTitle(bodyMd: string): string {
  const firstLine = bodyMd.split("\n")[0]?.replace(/^#+\s*/, "").trim();
  return firstLine || "無題のノート";
}

type Tab = "notes" | "tasks";

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  // Load data on mount
  useEffect(() => {
    getNotes()
      .then(setNotes)
      .catch(() => setNotes([]));
    getTasks()
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  const handleCreateNote = useCallback(async () => {
    const note: Note = {
      id: generateId(),
      title: "無題のノート",
      body_md: "",
      updated_at: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    setSelectedNoteId(note.id);
    setActiveTab("notes");
    await saveNote(note);
  }, [notes]);

  const handleEditorChange = useCallback(
    async (value: string) => {
      if (!selectedNoteId) return;
      const note: Note = {
        id: selectedNoteId,
        title: extractTitle(value),
        body_md: value,
        updated_at: new Date().toISOString(),
      };
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedNoteId ? note : n))
      );
      await saveNote(note);
    },
    [selectedNoteId]
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedNoteId === id) setSelectedNoteId(null);
      await deleteNoteStorage(id);
    },
    [selectedNoteId]
  );

  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim()) return;
    const task: Task = {
      id: generateId(),
      title: newTaskTitle.trim(),
      due_date: null,
      remind_at: null,
      done: false,
      updated_at: new Date().toISOString(),
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    setNewTaskTitle("");
    await saveTask(task);
  }, [newTaskTitle, tasks]);

  const handleToggleTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const updated: Task = {
        ...task,
        done: !task.done,
        updated_at: new Date().toISOString(),
      };
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      await saveTask(updated);
    },
    [tasks]
  );

  const handleDeleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTaskStorage(id);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
      {/* Drag region */}
      <div
        data-tauri-drag-region
        className="h-8 flex items-center justify-center shrink-0 bg-gray-900/80 select-none cursor-move"
      >
        <span className="text-[10px] text-gray-500 tracking-widest uppercase">
          Flote
        </span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-56 flex flex-col border-r border-gray-700 bg-gray-800/50 shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              className={`flex-1 py-2 text-xs font-medium ${
                activeTab === "notes"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("notes")}
            >
              ノート
            </button>
            <button
              className={`flex-1 py-2 text-xs font-medium ${
                activeTab === "tasks"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              onClick={() => setActiveTab("tasks")}
            >
              タスク
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "notes" && (
              <div>
                <button
                  onClick={handleCreateNote}
                  className="w-full py-2 px-3 text-xs text-blue-400 hover:bg-gray-700/50 text-left"
                >
                  + 新しいノート
                </button>
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`group flex items-center px-3 py-2 cursor-pointer text-sm ${
                      selectedNoteId === note.id
                        ? "bg-gray-700 text-white"
                        : "text-gray-300 hover:bg-gray-700/50"
                    }`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <span className="truncate flex-1">{note.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 ml-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "tasks" && (
              <div>
                <div className="flex px-3 py-2 gap-1">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                    placeholder="タスクを追加..."
                    className="flex-1 bg-gray-700 text-sm text-white px-2 py-1 rounded outline-none placeholder-gray-500"
                  />
                </div>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => handleToggleTask(task.id)}
                      className="mr-2 accent-blue-500"
                    />
                    <span
                      className={`flex-1 truncate ${
                        task.done
                          ? "line-through text-gray-500"
                          : "text-gray-300"
                      }`}
                    >
                      {task.title}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 ml-1 text-xs"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex-1 min-w-0">
          {selectedNote ? (
            <Editor value={selectedNote.body_md} onChange={handleEditorChange} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              ノートを選択するか、新しいノートを作成してください
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
