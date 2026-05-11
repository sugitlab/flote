import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Note } from "@flote/types";
import { relativeDate } from "../utils/date";
import { extractTags, allTagsFromNotes } from "../utils/tags";
import styles from "./NoteList.module.css";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectMode = selectedIds.size > 0;

  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagBtnRef = useRef<HTMLDivElement>(null);
  const tagSearchRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(() => allTagsFromNotes(notes), [notes]);

  const filteredTagOptions = useMemo(
    () =>
      tagSearch
        ? allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()))
        : allTags,
    [allTags, tagSearch]
  );

  const filteredNotes = useMemo(
    () =>
      activeTag
        ? notes.filter((n) => extractTags(n.body_md).includes(activeTag))
        : notes,
    [notes, activeTag]
  );

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
          <span className={styles.selectCount}>{selectedIds.size}件選択中</span>
          <div className={styles.selectActions}>
            <button className={styles.deleteSelectedBtn} onClick={handleDeleteSelected}>
              削除
            </button>
            <button className={styles.cancelBtn} onClick={clearSelect}>
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.toolbar}>
          <button className={styles.newButton} onClick={onNew}>
            + 新しいノート
          </button>

          {allTags.length > 0 && (
            <div className={styles.tagDropdownWrap} ref={tagBtnRef}>
              <button
                className={`${styles.tagFilterBtn} ${activeTag ? styles.tagFilterBtnActive : ""}`}
                onClick={() => setTagDropdownOpen((v) => !v)}
                title="タグで絞り込む"
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
                    placeholder="タグを検索..."
                  />
                  <div className={styles.tagList}>
                    {filteredTagOptions.length === 0 && (
                      <div className={styles.tagListEmpty}>見つかりません</div>
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
              <div className={styles.itemTitle}>{note.title || "無題のノート"}</div>
              <div className={styles.itemDate}>{relativeDate(note.updated_at)}</div>
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
          {activeTag ? `#${activeTag} のノートはありません` : "ノートがありません"}
        </div>
      )}
    </div>
  );
}
