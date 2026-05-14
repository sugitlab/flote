import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Note } from "@flote/types";
import { relativeDate } from "../utils/date";
import { extractTags, allTagsFromNotes } from "../utils/tags";
import { useT } from "../hooks/useT";
import styles from "./NoteList.module.css";

type SortOrder = "updated" | "title";

type Props = {
  notes: Note[];
  activeNoteId: string | null;
  activeTag?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onNew: () => void;
  onTagFilter?: (tag: string | null) => void;
};

export default function NoteList({
  notes,
  activeNoteId,
  activeTag,
  onSelect,
  onDelete,
  onDeleteMultiple,
  onNew,
  onTagFilter,
}: Props) {
  const t = useT();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;

  const [sortOrder, setSortOrder] = useState<SortOrder>("updated");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortBtnRef = useRef<HTMLButtonElement>(null);

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagBtnRef = useRef<HTMLDivElement>(null);
  const tagSearchRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(() => allTagsFromNotes(notes), [notes]);

  const filteredTagOptions = useMemo(
    () =>
      tagSearch
        ? allTags.filter((tag) => tag.toLowerCase().includes(tagSearch.toLowerCase()))
        : allTags,
    [allTags, tagSearch]
  );

  const filteredNotes = useMemo(() => {
    const arr = activeTag
      ? notes.filter((n) => extractTags(n.body_md).includes(activeTag))
      : [...notes];
    if (sortOrder === "title") {
      arr.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "ja"));
    } else {
      arr.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return arr;
  }, [notes, activeTag, sortOrder]);

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
          <button className={styles.newButton} onClick={onNew}>
            {t.noteList.newNote}
          </button>

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

      {filteredNotes.map((note, idx) => {
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
              idx < 9 && <span className={styles.indexBadge}>{idx + 1}</span>
            )}
            <div className={styles.itemContent}>
              <div className={styles.itemTitle}>{note.title || t.defaults.untitledNote}</div>
              <div className={styles.itemDate}>{relativeDate(note.updated_at, t.date)}</div>
            </div>
            {!selectMode && (
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(note.id);
                }}
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
