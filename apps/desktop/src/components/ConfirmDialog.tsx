import { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

type Props = {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the dialog itself so keyboard events land here, not the main app.
    dialogRef.current?.focus();

    // Capture phase: block ALL keys from reaching the main app while dialog is open.
    const handler = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [onConfirm, onCancel]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      {/* tabIndex / outline:none so the div is focusable but invisible */}
      <div
        ref={dialogRef}
        className={styles.dialog}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            キャンセル<span className={styles.kbd}>Esc</span>
          </button>
          <button className={`${styles.btn} ${styles.btnConfirm}`} onClick={onConfirm}>
            削除<span className={styles.kbd}>↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
