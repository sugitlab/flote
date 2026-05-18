import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Task } from "@flote/types";
import { extractTags, allTagsFromTasks } from "../utils/tags";
import { relativeDate } from "../utils/date";
import { useT } from "../hooks/useT";

type SortOrder = "updated" | "due";

type TaskListProps = {
  tasks: Task[];
  activeTaskId: string | null;
  activeTag?: string | null;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onAddTask: () => void;
  onSelectTask: (id: string) => void;
  onTagFilter?: (tag: string | null) => void;
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


type Group = { label: string; tasks: Task[]; danger?: boolean };

export function groupTasks(tasks: Task[], labels?: { overdue: string; today: string; upcoming: string; done: string }): Group[] {
  const l = labels ?? { overdue: "期限切れ", today: "今日", upcoming: "今後", done: "完了済み" };
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
  if (overdue.length) groups.push({ label: l.overdue, tasks: overdue, danger: true });
  if (todayTasks.length) groups.push({ label: l.today, tasks: todayTasks });
  if (upcoming.length) groups.push({ label: l.upcoming, tasks: upcoming });
  if (done.length) groups.push({ label: l.done, tasks: done });
  return groups;
}

export default function TaskList({
  tasks,
  activeTaskId,
  activeTag,
  onToggleDone,
  onDelete,
  onDeleteMultiple,
  onAddTask,
  onSelectTask,
  onTagFilter,
}: TaskListProps) {
  const t = useT();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;
  const [sortOrder, setSortOrder] = useState<SortOrder>("due");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagSearchRef = useRef<HTMLInputElement>(null);
  const tagBtnRef = useRef<HTMLButtonElement>(null);

  const allTags = useMemo(() => allTagsFromTasks(tasks), [tasks]);
  const filteredTagOptions = useMemo(
    () => tagSearch ? allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase())) : allTags,
    [allTags, tagSearch]
  );

  useEffect(() => {
    if (!sortMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortBtnRef.current && !sortBtnRef.current.closest("[data-sort-menu]")?.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortMenuOpen]);

  useEffect(() => {
    if (!tagDropdownOpen) return;
    setTimeout(() => tagSearchRef.current?.focus(), 0);
    const handler = (e: MouseEvent) => {
      if (tagBtnRef.current && !tagBtnRef.current.closest("[data-tag-menu]")?.contains(e.target as Node)) {
        setTagDropdownOpen(false);
        setTagSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

  const handleTagSelect = useCallback(
    (tag: string) => {
      onTagFilter?.(activeTag === tag ? null : tag);
      setTagDropdownOpen(false);
      setTagSearch("");
    },
    [activeTag, onTagFilter]
  );

  const sortedTasks = useMemo(() => {
    const source = activeTag
      ? tasks.filter((t) => extractTags(t.body_md).includes(activeTag))
      : tasks;
    const arr = [...source];
    if (sortOrder === "updated") {
      arr.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    } else {
      arr.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }
    return arr;
  }, [tasks, sortOrder, activeTag]);

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

  const groups = groupTasks(sortedTasks, t.taskList.groups);
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
              {relativeDate(task.due_date!, t.date)}
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
            {t.taskList.selectedCount(selectedIds.size)}
          </span>
          <div className="flex gap-[6px]">
            <button
              className="text-[11px] px-2 py-0.5 rounded border-none bg-[var(--danger)] text-white cursor-pointer opacity-100 hover:opacity-85 transition-opacity"
              onClick={handleDeleteSelected}
            >
              {t.taskList.delete}
            </button>
            <button
              className="text-[11px] px-2 py-0.5 rounded border-none bg-[var(--bg-input)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              onClick={clearSelect}
            >
              {t.taskList.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center border-b border-[var(--border)]">
          <button
            onClick={onAddTask}
            className="flex-1 text-left text-[11px] text-[var(--accent)] bg-transparent border-none cursor-pointer py-[8px] px-[10px] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {t.taskList.newTask}
          </button>
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="relative" data-tag-menu="">
              <button
                ref={tagBtnRef}
                onClick={() => setTagDropdownOpen((v) => !v)}
                title={t.taskList.filterByTag}
                className={[
                  "flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border-none cursor-pointer transition-colors max-w-[72px] truncate",
                  activeTag
                    ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
                    : tagDropdownOpen
                    ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                    : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                ].join(" ")}
              >
                {activeTag ? `#${activeTag}` : "#"}
                {activeTag && (
                  <span
                    className="ml-0.5 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); onTagFilter?.(null); }}
                  >✕</span>
                )}
              </button>
              {tagDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--bg-sidebar)] shadow-lg overflow-hidden">
                  <div className="p-1.5 border-b border-[var(--border)]">
                    <input
                      ref={tagSearchRef}
                      className="w-full text-[11px] px-2 py-1 rounded border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] outline-none"
                      placeholder={t.taskList.searchTags}
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-[180px] overflow-y-auto">
                    {filteredTagOptions.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-[var(--text-muted)]">{t.taskList.noTags}</div>
                    ) : filteredTagOptions.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleTagSelect(tag)}
                        className={[
                          "w-full text-left text-[11px] px-3 py-1.5 border-none cursor-pointer transition-colors flex items-center gap-1.5",
                          activeTag === tag
                            ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] font-semibold"
                            : "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                        ].join(" ")}
                      >
                        <span className="opacity-50">#</span>{tag}
                        {activeTag === tag && <span className="ml-auto">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Sort menu */}
          <div className="relative" data-sort-menu="">
            <button
              ref={sortBtnRef}
              onClick={() => setSortMenuOpen((v) => !v)}
              title={t.taskList.sort}
              className={[
                "flex items-center gap-0.5 text-[10px] px-2 py-1 mr-1 rounded border-none cursor-pointer transition-colors",
                sortMenuOpen
                  ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                  : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
              ].join(" ")}
            >
              ⇅
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[130px] rounded-md border border-[var(--border)] bg-[var(--bg-sidebar)] shadow-lg overflow-hidden">
                {(
                  [
                    { key: "updated", label: t.taskList.sortByUpdated },
                    { key: "due",     label: t.taskList.sortByDue },
                  ] as { key: SortOrder; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setSortOrder(key); setSortMenuOpen(false); }}
                    className={[
                      "w-full text-left text-[11px] px-3 py-2 border-none cursor-pointer transition-colors",
                      sortOrder === key
                        ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)] font-semibold"
                        : "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                    ].join(" ")}
                  >
                    {sortOrder === key && "✓ "}{label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
        {sortedTasks.length === 0 && (
          <div className="px-3 py-4 text-[11px] text-[var(--text-muted)]">
            {activeTag ? t.taskList.emptyFiltered(activeTag) : t.taskList.empty}
          </div>
        )}
      </div>
    </div>
  );
}
