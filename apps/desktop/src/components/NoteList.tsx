import { useState, useCallback } from "react";
import type { Note } from "@flote/types";
import { relativeDate } from "../utils/date";
import styles from "./NoteList.module.css";

type Props = {
  notes: Note[];
  activeNoteId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onNew: () => void;
};

export default function NoteList({
  notes,
  activeNoteId,
  onSelect,
  onDelete,
  onDeleteMultiple,
  onNew,
}: Props) {
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
        <button className={styles.newButton} onClick={onNew}>
          + 新しいノート
        </button>
      )}

      {notes.map((note, idx) => {
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
    </div>
  );
}
