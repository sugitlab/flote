import type { Task } from "@flote/types";

type TaskListProps = {
  tasks: Task[];
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onAddTask: (title: string, dueDate: string | null) => void;
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
  onToggleDone,
  onDelete,
  onAddTask,
}: TaskListProps) {
  const pending = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = (fd.get("title") as string).trim();
    if (!title) return;
    const dueDate = (fd.get("due_date") as string) || null;
    onAddTask(title, dueDate);
    form.reset();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add form */}
      <form onSubmit={handleAdd} className="px-3 py-2 border-b border-gray-700">
        <input
          name="title"
          type="text"
          placeholder="タスクを追加..."
          className="w-full bg-gray-700 text-sm text-white px-2 py-1.5 rounded outline-none placeholder-gray-500 mb-1"
        />
        <input
          name="due_date"
          type="date"
          className="w-full bg-gray-700 text-xs text-gray-300 px-2 py-1 rounded outline-none"
        />
      </form>

      {/* Pending tasks */}
      <div className="flex-1 overflow-y-auto">
        {pending.map((task) => (
          <div
            key={task.id}
            className="group flex items-center px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={false}
              onChange={() => onToggleDone(task.id)}
              className="mr-2 accent-blue-500 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <span
                className={`block truncate ${
                  isOverdue(task) ? "text-red-400" : "text-gray-300"
                }`}
              >
                {task.title}
              </span>
              {task.due_date && (
                <span
                  className={`text-[10px] ${
                    isOverdue(task) ? "text-red-500" : "text-gray-500"
                  }`}
                >
                  {formatDate(task.due_date)}
                </span>
              )}
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 ml-1 text-xs shrink-0"
              onClick={() => onDelete(task.id)}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Completed section */}
        {completed.length > 0 && (
          <>
            <div className="px-3 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-t border-gray-700 mt-1">
              完了 ({completed.length})
            </div>
            {completed.map((task) => (
              <div
                key={task.id}
                className="group flex items-center px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={true}
                  onChange={() => onToggleDone(task.id)}
                  className="mr-2 accent-blue-500 shrink-0"
                />
                <span className="flex-1 truncate line-through text-gray-600">
                  {task.title}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 ml-1 text-xs shrink-0"
                  onClick={() => onDelete(task.id)}
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
