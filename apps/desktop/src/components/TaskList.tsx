import type { Task } from "@flote/types";

type TaskListProps = {
  tasks: Task[];
  activeTaskId: string | null;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onAddTask: () => void;
  onSelectTask: (id: string) => void;
};

function isOverdue(task: Task): boolean {
  if (task.done || !task.due_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.due_date <= today;
}

function formatDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
  });
}

export default function TaskList({
  tasks,
  activeTaskId,
  onToggleDone,
  onDelete,
  onAddTask,
  onSelectTask,
}: TaskListProps) {
  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  return (
    <div className="flex flex-col h-full">
      {/* Add button */}
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <button
          onClick={onAddTask}
          className="w-full text-left text-sm text-[var(--accent)] bg-transparent border-none cursor-pointer py-1 hover:bg-[var(--bg-hover)] rounded px-2 transition-colors"
        >
          + 新しいタスク
        </button>
      </div>

      {/* Pending tasks */}
      <div className="flex-1 overflow-y-auto">
        {pending.map((task) => {
          const globalIdx = tasks.indexOf(task);
          return (
          <div
            key={task.id}
            className={`group flex items-center px-3 py-2 text-sm cursor-pointer transition-colors ${
              activeTaskId === task.id
                ? "bg-[var(--bg-active)]"
                : "hover:bg-[var(--bg-hover)]"
            }`}
            onClick={() => onSelectTask(task.id)}
          >
            {globalIdx < 9 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold text-[var(--text-muted)] bg-[var(--bg-input)] rounded mr-1.5 shrink-0">
                {globalIdx + 1}
              </span>
            )}
            <input
              type="checkbox"
              checked={false}
              onChange={(e) => {
                e.stopPropagation();
                onToggleDone(task.id);
              }}
              className="mr-2 accent-blue-500 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <span
                className={`block truncate ${
                  isOverdue(task) ? "text-[var(--danger)]" : "text-[var(--text-primary)]"
                }`}
              >
                {task.title}
              </span>
              {task.due_date && (
                <span
                  className={`text-[10px] ${
                    isOverdue(task) ? "text-[var(--danger)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] ml-1 text-xs shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
            >
              ✕
            </button>
          </div>
          );
        })}

        {/* Completed section */}
        {completed.length > 0 && (
          <>
            <div className="px-3 py-1 text-[10px] text-[var(--text-muted)] uppercase tracking-wider border-t border-[var(--border)] mt-1">
              完了 ({completed.length})
            </div>
            {completed.map((task) => (
              <div
                key={task.id}
                className={`group flex items-center px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                  activeTaskId === task.id
                    ? "bg-[var(--bg-active)]"
                    : "hover:bg-[var(--bg-hover)]"
                }`}
                onClick={() => onSelectTask(task.id)}
              >
                <input
                  type="checkbox"
                  checked={true}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleDone(task.id);
                  }}
                  className="mr-2 accent-blue-500 shrink-0"
                />
                <span className="flex-1 truncate line-through text-[var(--text-muted)]">
                  {task.title}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] ml-1 text-xs shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
