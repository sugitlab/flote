import { useState, useCallback } from "react";
import type { Task } from "@flote/types";

type TaskListProps = {
  tasks: Task[];
  activeTaskId: string | null;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onAddTask: () => void;
  onSelectTask: (id: string) => void;
};

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isOverdue(task: Task): boolean {
  if (task.done || !task.due_date) return false;
  return task.due_date < todayStr();
}

function formatDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

type Group = { label: string; tasks: Task[]; danger?: boolean };

export function groupTasks(tasks: Task[]): Group[] {
  const today = todayStr();
  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.done) {
      done.push(t);
    } else if (t.due_date && t.due_date < today) {
      overdue.push(t);
    } else if (t.due_date === today) {
      todayTasks.push(t);
    } else {
      upcoming.push(t);
    }
  }

  const groups: Group[] = [];
  if (overdue.length) groups.push({ label: "期限切れ", tasks: overdue, danger: true });
  if (todayTasks.length) groups.push({ label: "今日", tasks: todayTasks });
  if (upcoming.length) groups.push({ label: "今後", tasks: upcoming });
  if (done.length) groups.push({ label: "完了済み", tasks: done });
  return groups;
}

export default function TaskList({
  tasks,
  activeTaskId,
  onToggleDone,
  onDelete,
  onDeleteMultiple,
  onAddTask,
  onSelectTask,
}: TaskListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelect = useCallback(() => setSelectedIds(new Set()), []);

  const handleItemClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.metaKey || e.ctrlKey || selectMode) {
        e.preventDefault();
        toggleSelect(id);
      } else {
        onSelectTask(id);
      }
    },
    [selectMode, toggleSelect, onSelectTask]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      toggleSelect(id);
    },
    [toggleSelect]
  );

  const handleDeleteSelected = useCallback(() => {
    onDeleteMultiple([...selectedIds]);
    clearSelect();
  }, [selectedIds, onDeleteMultiple, clearSelect]);

  const groups = groupTasks(tasks);
  const orderedIds = groups.flatMap((g) => g.tasks.map((t) => t.id));

  function renderTask(task: Task) {
    const isSelected = selectedIds.has(task.id);
    const globalIdx = orderedIds.indexOf(task.id);
    const overdue = isOverdue(task);

    return (
      <div
        key={task.id}
        className={[
          "group flex items-center px-3 py-2 text-[12px] cursor-pointer transition-colors select-none",
          isSelected
            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            : activeTaskId === task.id && !selectMode
            ? "bg-[var(--bg-active)]"
            : "hover:bg-[var(--bg-hover)]",
        ].join(" ")}
        onClick={(e) => handleItemClick(e, task.id)}
        onContextMenu={(e) => handleContextMenu(e, task.id)}
      >
        {selectMode ? (
          <span
            className={[
              "inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border-[1.5px] text-[9px] font-bold shrink-0 mr-1.5 transition-all",
              isSelected
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-[var(--text-muted)] text-transparent",
            ].join(" ")}
          >
            {isSelected && "✓"}
          </span>
        ) : (
          <>
            {globalIdx < 9 && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold text-[var(--text-muted)] bg-[var(--bg-input)] rounded mr-1.5 shrink-0">
                {globalIdx + 1}
              </span>
            )}
            <input
              type="checkbox"
              checked={task.done}
              onChange={(e) => {
                e.stopPropagation();
                onToggleDone(task.id);
              }}
              className="mr-2 accent-blue-500 shrink-0"
            />
          </>
        )}

        <div className="flex flex-1 min-w-0 items-baseline gap-1.5">
          <span
            className={[
              "flex-1 min-w-0 truncate",
              task.done ? "line-through text-[var(--text-muted)]" : "",
              !task.done && overdue ? "text-[var(--danger)]" : "",
              !task.done && !overdue ? "text-[var(--text-primary)]" : "",
            ].join(" ")}
          >
            {task.title}
          </span>
          {task.due_date && !task.done && (
            <span className={`text-[10px] shrink-0 whitespace-nowrap ${overdue ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
              {formatDate(task.due_date)}
            </span>
          )}
        </div>

        {!selectMode && (
          <button
            className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] ml-1 text-xs shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {selectMode ? (
        <div className="flex items-center justify-between px-[10px] py-[6px] border-b border-[var(--border)]">
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">
            {selectedIds.size}件選択中
          </span>
          <div className="flex gap-[6px]">
            <button
              className="text-[11px] px-2 py-0.5 rounded border-none bg-[var(--danger)] text-white cursor-pointer opacity-100 hover:opacity-85 transition-opacity"
              onClick={handleDeleteSelected}
            >
              削除
            </button>
            <button
              className="text-[11px] px-2 py-0.5 rounded border-none bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              onClick={clearSelect}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onAddTask}
          className="w-full text-left text-[11px] text-[var(--accent)] bg-transparent border-none cursor-pointer py-[8px] px-[10px] hover:bg-[var(--bg-hover)] transition-colors"
        >
          + 新しいタスク
        </button>
      )}

      <div className="flex-1 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={group.label}>
            <div
              className={[
                "px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
                gi > 0 ? "border-t border-[var(--border)] mt-1" : "",
                group.danger ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
              ].join(" ")}
            >
              {group.label}
            </div>
            {group.tasks.map((task) => renderTask(task))}
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-[var(--text-muted)]">タスクがありません</div>
        )}
      </div>
    </div>
  );
}
