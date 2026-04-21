import { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

type Props = {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      // Arrow keys toggle focus between cancel and confirm
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused === confirmRef.current) {
          cancelRef.current?.focus();
        } else {
          confirmRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.message}>{message}</div>
        <div className={styles.actions}>
          <button ref={cancelRef} className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel}>
            キャンセル
          </button>
          <button
            ref={confirmRef}
            className={`${styles.btn} ${styles.btnConfirm}`}
            onClick={onConfirm}
          >
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
