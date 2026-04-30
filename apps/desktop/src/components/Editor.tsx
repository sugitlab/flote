import { useRef, useEffect, useMemo, useState } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { vim, Vim, getCM } from "@replit/codemirror-vim";
import type { EditorTheme } from "../editorThemes";
import { resolveEditorTheme } from "../editorThemes";
import { HLJS_THEME_CSS, renderPreview } from "../previewRenderer";

type EditorProps = {
  docId: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  onRequestEdit?: () => void;
  onExitEdit?: () => void;
  editorTheme?: EditorTheme;
  vimMode?: boolean;
};

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  ".cm-scroller": { overflow: "auto" },
  ".cm-content": { padding: "16px" },
  "&.cm-focused": { outline: "none" },
});

const themeCompartment = new Compartment();
const vimCompartment = new Compartment();
const escCompartment = new Compartment();

// Register vim ex commands globally once
let vimExCommandsRegistered = false;
function ensureVimExCommands(onExit: () => void) {
  if (vimExCommandsRegistered) return;
  vimExCommandsRegistered = true;
  Vim.defineEx("quit", "q", () => onExit());
  Vim.defineEx("wq", "", () => onExit());
  Vim.defineEx("x", "", () => onExit());
  Vim.defineEx("write", "w", () => { /* auto-saved */ });
  // ESC in normal mode → exit to preview
  Vim.map("<Esc>", ":q<CR>", "normal");
}

export default function Editor({ docId, value, onChange, editing, onExitEdit, editorTheme, vimMode = false }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onExitEditRef = useRef(onExitEdit);
  onExitEditRef.current = onExitEdit;
  const vimModeRef = useRef(vimMode);
  vimModeRef.current = vimMode;
  const [vimModeLabel, setVimModeLabel] = useState<string>("NORMAL");

  const escExt = useRef(
    keymap.of([{
      key: "Escape",
      run: () => { onExitEditRef.current?.(); return true; },
    }])
  );

  useEffect(() => {
    if (!containerRef.current) return;

    ensureVimExCommands(() => onExitEditRef.current?.());

    const state = EditorState.create({
      doc: value,
      extensions: [
        vimCompartment.of(vimMode ? vim() : []),
        escCompartment.of(vimMode ? [] : escExt.current),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        markdown({ codeLanguages: languages }),
        themeCompartment.of(resolveEditorTheme(editorTheme)),
        baseTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        placeholder("# タイトルを入力..."),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Listen for vim mode changes to update the status label
    const cm = getCM(view);
    if (cm) {
      cm.on("vim-mode-change", (e: { mode: string }) => {
        setVimModeLabel(e.mode.toUpperCase());
      });
    }

    return () => { view.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle vim mode without recreating the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: [
        vimCompartment.reconfigure(vimMode ? vim() : []),
        escCompartment.reconfigure(vimMode ? [] : escExt.current),
      ],
    });
    if (!vimMode) {
      setVimModeLabel("NORMAL");
      return;
    }
    // Re-attach mode change listener after vim is re-enabled
    requestAnimationFrame(() => {
      const cm = getCM(view);
      if (cm) {
        cm.on("vim-mode-change", (e: { mode: string }) => {
          setVimModeLabel(e.mode.toUpperCase());
        });
      }
    });
  }, [vimMode]);

  // Swap editor theme without recreating the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(resolveEditorTheme(editorTheme)),
    });
  }, [editorTheme]);

  // Inject highlight.js CSS for preview code blocks
  useEffect(() => {
    const id = "hljs-theme";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = HLJS_THEME_CSS[editorTheme ?? "oneDark"];
  }, [editorTheme]);


  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (editing) {
      view.focus();
    } else {
      view.contentDOM.blur();
      // Reset vim to normal mode so next entry is always clean
      if (vimMode) {
        const cm = getCM(view);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (cm && (cm as any).state?.vim?.insertMode) Vim.exitInsertMode(cm as any);
      }
    }
  }, [editing, vimMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  useEffect(() => {
    if (editing) return;
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value, editing]);

  const previewHtml = useMemo(() => {
    if (editing) return "";
    return renderPreview(value);
  }, [value, editing]);

  return (
    <div className="h-full w-full overflow-hidden relative">
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
        style={{ display: editing ? "block" : "none" }}
      />
      {!editing && (
        <div className="h-full w-full overflow-auto preview-area">
          <div
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}
      {vimMode && editing && (
        <div style={{
          position: "absolute",
          bottom: 6,
          left: 10,
          fontSize: 11,
          fontFamily: "monospace",
          color: "var(--text-secondary)",
          pointerEvents: "none",
          userSelect: "none",
        }}>
          -- {vimModeLabel} --
        </div>
      )}
    </div>
  );
}
