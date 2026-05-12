import { useEffect, useRef } from "react";
import { useT } from "../hooks/useT";
import styles from "./ConfirmDialog.module.css";

type Props = {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: Props) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

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
      <div
        ref={dialogRef}
        className={styles.dialog}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            {t.confirm.cancel}<span className={styles.kbd}>Esc</span>
          </button>
          <button className={`${styles.btn} ${styles.btnConfirm}`} onClick={onConfirm}>
            {confirmLabel ?? t.confirm.delete}<span className={styles.kbd}>↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
