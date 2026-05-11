import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getConfig } from "./config";
import styles from "./QuickCapture.module.css";

function applyTheme(theme: string) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (dark ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", resolved);
}

export default function QuickCapture() {
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hide = useCallback(() => {
    invoke("hide_capture_window").catch(console.error);
  }, []);

  const discard = useCallback(() => {
    setText("");
    setConfirming(false);
    hide();
  }, [hide]);

  const save = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed) {
      invoke("relay_quick_note", { text: trimmed }).catch(console.error);
    }
    setText("");
    setConfirming(false);
    hide();
  }, [text, hide]);

  useEffect(() => {
    const win = getCurrentWindow();
    let blurTimer: ReturnType<typeof setTimeout>;

    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      clearTimeout(blurTimer);
      if (focused) {
        // Re-read theme each time the window appears (may have changed in main window)
        getConfig().then((c) => applyTheme(c.theme)).catch(() => {});
        setText("");
        setConfirming(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        blurTimer = setTimeout(hide, 150);
      }
    });

    // Apply theme on first mount
    getConfig().then((c) => applyTheme(c.theme)).catch(() => {});
    requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      clearTimeout(blurTimer);
      unlisten.then((fn) => fn());
    };
  }, [hide]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (confirming) {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          discard();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setConfirming(false);
          requestAnimationFrame(() => inputRef.current?.focus());
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (text.trim()) {
          setConfirming(true);
        } else {
          hide();
        }
      } else if (e.key === "Enter" && e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        save();
      }
      // Plain Enter: browser default (newline / IME confirmation)
    },
    [save, discard, hide, text, confirming]
  );

  return (
    <div className={styles.container}>
      <textarea
        ref={inputRef}
        className={styles.input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="クイックメモ..."
        spellCheck={false}
        autoComplete="off"
      />
      <span className={styles.hint}>
        {text ? "⇧↵ 保存  Esc 閉じる" : "Esc"}
      </span>

      {confirming && (
        <div className={styles.overlay}>
          <p className={styles.overlayMessage}>入力内容を破棄しますか？</p>
          <p className={styles.overlayHint}>
            <span>↵ 破棄</span>
            <span>Esc キャンセル</span>
          </p>
        </div>
      )}
    </div>
  );
}
