import { useRef, useEffect, useMemo } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { marked } from "marked";
import DOMPurify from "dompurify";

type EditorProps = {
  docId: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  onRequestEdit?: () => void;
  onExitEdit?: () => void;
};

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-content": {
    padding: "16px",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export default function Editor({ docId, value, onChange, editing, onExitEdit }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onExitEditRef = useRef(onExitEdit);
  onExitEditRef.current = onExitEdit;
  const editingRef = useRef(editing);
  editingRef.current = editing;

  // Create the CodeMirror instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const escKeymap = keymap.of([
      {
        key: "Escape",
        run: () => {
          onExitEditRef.current?.();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: value,
      extensions: [
        escKeymap,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        markdown({ codeLanguages: languages }),
        oneDark,
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

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus when entering edit mode
  useEffect(() => {
    if (editing && viewRef.current) {
      viewRef.current.focus();
    }
  }, [editing]);

  // Sync content when switching to a different document (always replace)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
    // docId changing means the user switched notes — always sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Sync remote updates only while NOT editing (preview mode)
  // While editing, trust CodeMirror's internal state to avoid cursor jumps
  useEffect(() => {
    if (editing) return;
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value, editing]);

  const previewHtml = useMemo(() => {
    if (editing) return "";
    const raw = marked.parse(value || "*ノートが空です*") as string;
    return DOMPurify.sanitize(raw);
  }, [value, editing]);

  return (
    <div className="h-full w-full overflow-hidden relative">
      {/* CodeMirror editor */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden"
        style={{ display: editing ? "block" : "none" }}
      />
      {/* Markdown preview */}
      {!editing && (
        <div className="h-full w-full overflow-auto preview-area">
          <div
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      )}
    </div>
  );
}
