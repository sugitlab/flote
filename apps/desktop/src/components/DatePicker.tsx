import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import { format, addDays, startOfWeek, addWeeks } from "date-fns";
import { ja } from "date-fns/locale";
import "react-day-picker/style.css";
import styles from "./DatePicker.module.css";

type Props = {
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
};

export default function DatePicker({ value, onChange, placeholder = "期日を設定" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(value + "T00:00:00") : undefined;

  const pick = useCallback(
    (date: Date | undefined) => {
      onChange(date ? format(date, "yyyy-MM-dd") : null);
      setOpen(false);
    },
    [onChange]
  );

  const quickPick = useCallback(
    (date: Date) => {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const today = new Date();
  const nextMonday = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${value ? styles.triggerHasValue : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {value ?? placeholder}
      </button>

      {open && (
        <div className={styles.popover}>
          <div className={styles.quickRow}>
            <button type="button" className={styles.quick} onClick={() => quickPick(today)}>
              今日
            </button>
            <button type="button" className={styles.quick} onClick={() => quickPick(addDays(today, 1))}>
              明日
            </button>
            <button type="button" className={styles.quick} onClick={() => quickPick(nextMonday)}>
              来週月曜
            </button>
            {value && (
              <button
                type="button"
                className={`${styles.quick} ${styles.quickClear}`}
                onClick={() => { onChange(null); setOpen(false); }}
              >
                クリア
              </button>
            )}
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={pick}
            locale={ja}
            className={styles.calendar}
          />
        </div>
      )}
    </div>
  );
}
