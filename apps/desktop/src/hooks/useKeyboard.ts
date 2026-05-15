import { useEffect } from "react";
import { useUIStore } from "../store/uiStore";

type KeyboardActions = {
  onNewNote: () => void;
  onNewTask: () => void;
  onPrevItem: () => void;
  onNextItem: () => void;
  onCycleTheme: () => void;
  onSelectByIndex: (index: number) => void;
  onEnterEditor: () => void;
  onDeleteSelected: () => void;
  onToggleSidebar: () => void;
  sidebarToggleShortcut?: string;
};

export function useKeyboard(actions: KeyboardActions) {
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const isSettingsOpen = useUIStore((s) => s.isSettingsOpen);
  const setActiveTab = useUIStore((s) => s.setActiveTab);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const inEditor = target.closest(".cm-editor") !== null;

      // Esc: close modals or blur filter
      if (e.key === "Escape") {
        if (isCommandPaletteOpen) {
          setCommandPaletteOpen(false);
          e.preventDefault();
          return;
        }
        if (isSettingsOpen) {
          setSettingsOpen(false);
          e.preventDefault();
          return;
        }
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      // ⌘K: toggle command palette
      if (meta && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
        return;
      }

      // Sidebar toggle shortcut (default ⌘B, configurable)
      const shortcut = actions.sidebarToggleShortcut ?? "CmdOrCtrl+B";
      const sKey = shortcut.toLowerCase().replace("cmdorctrl+", "").replace("meta+", "").replace("ctrl+", "");
      if (meta && e.key.toLowerCase() === sKey) {
        e.preventDefault();
        actions.onToggleSidebar();
        return;
      }

      // Skip editor-conflicting shortcuts when inside CodeMirror
      if (inEditor) return;

      // ⌘N: new note
      if (meta && !e.shiftKey && e.key === "n") {
        e.preventDefault();
        actions.onNewNote();
        return;
      }

      // ⌘T: new task
      if (meta && !e.shiftKey && e.key === "t") {
        e.preventDefault();
        actions.onNewTask();
        return;
      }

      // ⌘1: notes tab
      if (meta && e.key === "1") {
        e.preventDefault();
        setActiveTab("notes");
        return;
      }

      // ⌘2: tasks tab
      if (meta && e.key === "2") {
        e.preventDefault();
        setActiveTab("tasks");
        return;
      }

      // ⌘3: expenses tab
      if (meta && e.key === "3") {
        e.preventDefault();
        setActiveTab("expenses");
        return;
      }

      // ⌘↑: prev item
      if (meta && e.key === "ArrowUp") {
        e.preventDefault();
        actions.onPrevItem();
        return;
      }

      // ⌘↓: next item
      if (meta && e.key === "ArrowDown") {
        e.preventDefault();
        actions.onNextItem();
        return;
      }

      // ⌘⇧L: cycle theme
      if (meta && e.shiftKey && e.key === "L") {
        e.preventDefault();
        actions.onCycleTheme();
        return;
      }

      // ⌘,: settings
      if (meta && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // 1-9: select item by index (no modifier, not in input)
      const inInput = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (!meta && !e.shiftKey && !e.altKey && !inInput) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          e.preventDefault();
          actions.onSelectByIndex(num - 1);
          return;
        }
      }

      // Enter: enter edit mode (no modifier, not in input/editor)
      if (e.key === "Enter" && !meta && !e.shiftKey && !e.altKey && !inInput) {
        e.preventDefault();
        actions.onEnterEditor();
        return;
      }

      // ⌘Backspace / Delete: delete selected item
      const isDeleteKey = (meta && e.key === "Backspace") || e.key === "Delete";
      if (isDeleteKey && !inEditor && !inInput) {
        e.preventDefault();
        actions.onDeleteSelected();
        return;
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    isCommandPaletteOpen,
    isSettingsOpen,
    setCommandPaletteOpen,
    setSettingsOpen,
    setActiveTab,
    actions,
  ]);
}
