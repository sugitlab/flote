import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Note } from "@flote/types";
import { relativeDate } from "../utils/date";
import { extractTags, allTagsFromNotes } from "../utils/tags";
import { useT } from "../hooks/useT";
import { useUIStore } from "../store/uiStore";
import styles from "./NoteList.module.css";

type SortOrder = "updated" | "title";

// Strip lightweight Markdown syntax to build a readable card preview.
function notePreview(note: Note): string {
  if (note.note_type === "excalidraw") return "";
  return note.body_md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/[*_~]/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

type Props = {
  notes: Note[];
  activeNoteId: string | null;
  activeTag?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onNew: () => void;
  onNewExcalidraw?: () => void;
  onTagFilter?: (tag: string | null) => void;
  onTogglePin: (id: string) => void;
  onVisibleChange?: (orderedIds: string[]) => void;
  onEnsureBody?: (id: string) => void;
};

export default function NoteList({
  notes,
  activeNoteId,
  activeTag,
  onSelect,
  onDelete,
  onDeleteMultiple,
  onNew,
  onNewExcalidraw,
  onTagFilter,
  onTogglePin,
  onVisibleChange,
  onEnsureBody,
}: Props) {
  const t = useT();
  const viewMode = useUIStore((s) => s.noteViewMode);
  const toggleViewMode = useUIStore((s) => s.toggleNoteViewMode);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;

  const [newDropOpen, setNewDropOpen] = useState(false);
  const newWrapRef = useRef<HTMLDivElement>(null);

  const [sortOrder, setSortOrder] = useState<SortOrder>("updated");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagBtnRef = useRef<HTMLDivElement>(null);
  const tagSearchRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(() => allTagsFromNotes(notes.filter((n) => n.note_type !== "excalidraw")), [notes]);

  const filteredTagOptions = useMemo(
    () =>
      tagSearch
        ? allTags.filter((tag) => tag.toLowerCase().includes(tagSearch.toLowerCase()))
        : allTags,
    [allTags, tagSearch]
  );

  const filteredNotes = useMemo(() => {
    const arr = activeTag
      ? notes.filter((n) => n.note_type !== "excalidraw" && extractTags(n.body_md).includes(activeTag))
      : [...notes];
    if (sortOrder === "title") {
      arr.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (a.title ?? "").localeCompare(b.title ?? "", "ja");
      });
    } else {
      arr.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      });
    }
    return arr;
  }, [notes, activeTag, sortOrder]);

  useEffect(() => {
    onVisibleChange?.(filteredNotes.map((n) => n.id));
  }, [filteredNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Card view shows a body preview, but bodies are loaded lazily. Ensure the
  // bodies of the notes shown as cards get hydrated. `onEnsureBody` is a cheap
  // no-op once a note's body is loaded, so we guard with a requested-set too.
  const requestedBodies = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (viewMode !== "card" || !onEnsureBody) return;
    for (const n of filteredNotes) {
      if (n.note_type === "excalidraw") continue;
      if (!n.body_md && !requestedBodies.current.has(n.id)) {
        requestedBodies.current.add(n.id);
        onEnsureBody(n.id);
      }
    }
  }, [viewMode, filteredNotes, onEnsureBody]);

  useEffect(() => {
    if (!newDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (newWrapRef.current && !newWrapRef.current.contains(e.target as Node)) {
        setNewDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [newDropOpen]);

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
    setTagSearch("");
    setTimeout(() => tagSearchRef.current?.focus(), 0);
    const handler = (e: MouseEvent) => {
      if (tagBtnRef.current && !tagBtnRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

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
        onSelect(id);
      }
    },
    [selectMode, toggleSelect, onSelect]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      toggleSelect(id);
    },
    [toggleSelect]
  );

  const setViewMode = useUIStore((s) => s.setNoteViewMode);
  const handleCardClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.metaKey || e.ctrlKey || selectMode) {
        e.preventDefault();
        toggleSelect(id);
      } else {
        onSelect(id);
        // Opening a card reveals the editor, which lives in the list layout.
        setViewMode("list");
      }
    },
    [selectMode, toggleSelect, onSelect, setViewMode]
  );

  const handleDeleteSelected = useCallback(() => {
    onDeleteMultiple([...selectedIds]);
    clearSelect();
  }, [selectedIds, onDeleteMultiple, clearSelect]);

  const handleSelectTag = useCallback(
    (tag: string) => {
      onTagFilter?.(activeTag === tag ? null : tag);
      setTagDropdownOpen(false);
    },
    [activeTag, onTagFilter]
  );

  return (
    <div className={styles.root}>
      {selectMode ? (
        <div className={styles.selectBar}>
          <span className={styles.selectCount}>{t.noteList.selectedCount(selectedIds.size)}</span>
          <div className={styles.selectActions}>
            <button className={styles.deleteSelectedBtn} onClick={handleDeleteSelected}>
              {t.noteList.delete}
            </button>
            <button className={styles.cancelBtn} onClick={clearSelect}>
              {t.noteList.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.toolbar}>
          <div className={styles.newWrap} ref={newWrapRef}>
            <button className={styles.newButton} onClick={onNew}>
              {t.noteList.newNote}
            </button>
            {onNewExcalidraw && (
              <button
                className={styles.newDropBtn}
                title="ノートの種類を選択"
                onClick={() => setNewDropOpen((v) => !v)}
              >
                ▾
              </button>
            )}
            {newDropOpen && (
              <div className={styles.newDropdown}>
                <button
                  className={styles.newDropItem}
                  onClick={() => { onNew(); setNewDropOpen(false); }}
                >
                  Markdownノート
                </button>
                <button
                  className={styles.newDropItem}
                  onClick={() => { onNewExcalidraw?.(); setNewDropOpen(false); }}
                >
                  Excalidrawノート
                </button>
              </div>
            )}
          </div>

          {/* Sort menu */}
          <div className={styles.sortWrap} data-sort-menu="">
            <button
              ref={sortBtnRef}
              className={`${styles.sortBtn} ${sortMenuOpen ? styles.sortBtnOpen : ""}`}
              onClick={() => setSortMenuOpen((v) => !v)}
              title={t.noteList.sort}
            >
              ⇅
            </button>
            {sortMenuOpen && (
              <div className={styles.sortDropdown}>
                {(
                  [
                    { key: "updated" as SortOrder, label: t.noteList.sortByUpdated },
                    { key: "title" as SortOrder, label: t.noteList.sortByTitle },
                  ]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`${styles.sortOption} ${sortOrder === key ? styles.sortOptionActive : ""}`}
                    onClick={() => { setSortOrder(key); setSortMenuOpen(false); }}
                  >
                    {sortOrder === key && "✓ "}{label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List / card view toggle */}
          <button
            className={styles.viewToggleBtn}
            onClick={toggleViewMode}
            title={viewMode === "card" ? t.noteList.viewAsList : t.noteList.viewAsCards}
            aria-label={viewMode === "card" ? t.noteList.viewAsList : t.noteList.viewAsCards}
          >
            {viewMode === "card" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            )}
          </button>

          {allTags.length > 0 && (
            <div className={styles.tagDropdownWrap} ref={tagBtnRef}>
              <button
                className={`${styles.tagFilterBtn} ${activeTag ? styles.tagFilterBtnActive : ""}`}
                onClick={() => setTagDropdownOpen((v) => !v)}
                title={t.noteList.filterByTag}
              >
                {activeTag ? `#${activeTag}` : "#"}
                {activeTag && (
                  <span
                    className={styles.tagClearX}
                    onClick={(e) => { e.stopPropagation(); onTagFilter?.(null); }}
                  >
                    ×
                  </span>
                )}
              </button>

              {tagDropdownOpen && (
                <div className={styles.tagDropdown}>
                  <input
                    ref={tagSearchRef}
                    className={styles.tagSearchInput}
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder={t.noteList.searchTags}
                  />
                  <div className={styles.tagList}>
                    {filteredTagOptions.length === 0 && (
                      <div className={styles.tagListEmpty}>{t.noteList.noTagsFound}</div>
                    )}
                    {filteredTagOptions.map((tag) => (
                      <button
                        key={tag}
                        className={`${styles.tagOption} ${activeTag === tag ? styles.tagOptionActive : ""}`}
                        onClick={() => handleSelectTag(tag)}
                      >
                        <span className={styles.tagOptionHash}>#</span>{tag}
                        {activeTag === tag && <span className={styles.tagOptionCheck}>✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === "card" && (
        <div className={styles.grid}>
          {filteredNotes.map((note, idx) => {
            const isSelected = selectedIds.has(note.id);
            const preview = notePreview(note);
            return (
              <div
                key={note.id}
                className={[
                  styles.card,
                  activeNoteId === note.id && !selectMode ? styles.cardActive : "",
                  isSelected ? styles.cardSelected : "",
                ].join(" ")}
                onClick={(e) => handleCardClick(e, note.id)}
                onContextMenu={(e) => handleContextMenu(e, note.id)}
              >
                <div className={styles.cardHeader}>
                  {selectMode ? (
                    <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ""}`}>
                      {isSelected && "✓"}
                    </span>
                  ) : note.pinned ? (
                    <span className={styles.pinIcon}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                      </svg>
                    </span>
                  ) : (
                    idx < 9 && <span className={styles.indexBadge}>{idx + 1}</span>
                  )}
                  <span className={styles.cardTitle}>
                    {note.title || t.defaults.untitledNote}
                    {note.note_type === "excalidraw" && (
                      <span className={styles.excalidrawBadge}>draw</span>
                    )}
                  </span>
                  {!selectMode && (
                    <button
                      className={styles.cardDeleteBtn}
                      onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                    >
                      ✕
                    </button>
                  )}
                </div>
                {note.note_type === "excalidraw" ? (
                  <div className={`${styles.cardBody} ${styles.cardBodyEmpty}`}>🎨</div>
                ) : preview ? (
                  <div className={styles.cardBody}>{preview}</div>
                ) : (
                  <div className={`${styles.cardBody} ${styles.cardBodyEmpty}`}>&nbsp;</div>
                )}
                <div className={styles.cardDate}>{relativeDate(note.updated_at, t.date)}</div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === "list" && filteredNotes.map((note, idx) => {
        const isSelected = selectedIds.has(note.id);
        return (
          <div
            key={note.id}
            className={[
              styles.item,
              activeNoteId === note.id && !selectMode ? styles.itemActive : "",
              isSelected ? styles.itemSelected : "",
            ].join(" ")}
            onClick={(e) => handleItemClick(e, note.id)}
            onContextMenu={(e) => handleContextMenu(e, note.id)}
          >
            {selectMode ? (
              <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ""}`}>
                {isSelected && "✓"}
              </span>
            ) : (
              note.pinned
                ? (
                  <span className={styles.pinIcon}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="17" x2="12" y2="22" />
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                    </svg>
                  </span>
                )
                : idx < 9 && <span className={styles.indexBadge}>{idx + 1}</span>
            )}
            <div className={styles.itemContent}>
              <div className={styles.itemTitle}>
                {note.title || t.defaults.untitledNote}
                {note.note_type === "excalidraw" && (
                  <span className={styles.excalidrawBadge}>draw</span>
                )}
              </div>
              <div className={styles.itemDate}>{relativeDate(note.updated_at, t.date)}</div>
            </div>
            {!selectMode && (
              <button
                className={styles.deleteBtn}
                onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {filteredNotes.length === 0 && (
        <div className={styles.emptyMsg}>
          {activeTag ? t.noteList.emptyFiltered(activeTag) : t.noteList.empty}
        </div>
      )}
    </div>
  );
}
