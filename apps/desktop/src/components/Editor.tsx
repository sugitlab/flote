import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import mermaid from "mermaid";
import { Svg2Roughjs } from "svg2roughjs";
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, placeholder, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { vim, Vim, getCM } from "@replit/codemirror-vim";
import type { EditorTheme } from "../editorThemes";
import { resolveEditorTheme } from "../editorThemes";
import { HLJS_THEME_CSS, renderPreview } from "../previewRenderer";
import { tagHighlighter } from "../utils/tagHighlighter";
import { getMermaidThemeConfig, type AccentColor } from "../mermaidThemes";

function normalizeSvgEl(svgEl: SVGSVGElement) {
  if (!svgEl.getAttribute("viewBox")) {
    const w = parseFloat(svgEl.getAttribute("width") ?? "") || svgEl.getBoundingClientRect().width;
    const h = parseFloat(svgEl.getAttribute("height") ?? "") || svgEl.getBoundingClientRect().height;
    if (w && h) svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");
  // Contain scaling: fill container width, but cap height at 60vh
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    const vw = parts[2], vh = parts[3];
    if (vw > 0 && vh > 0) {
      const container = (svgEl.closest(".mermaid") ?? svgEl.parentElement) as HTMLElement | null;
      const maxW = container?.clientWidth ?? window.innerWidth;
      const maxH = window.innerHeight * 0.6;
      const scale = Math.min(maxW / vw, maxH / vh);
      svgEl.style.width = `${vw * scale}px`;
      svgEl.style.height = `${vh * scale}px`;
      svgEl.style.maxWidth = "100%";
    }
  }
}

type EditorProps = {
  docId: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  onRequestEdit?: () => void;
  onExitEdit?: () => void;
  editorTheme?: EditorTheme;
  vimMode?: boolean;
  mermaidHandDrawn?: boolean;
  placeholderText?: string;
  emptyNoteText?: string;
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
const placeholderCompartment = new Compartment();

// Register visual-block insert (I in Ctrl+V mode) globally once.
// Creates one cursor per selected line at the block's start column so
// CodeMirror's native multiple-selection support handles simultaneous typing.
let vimBlockInsertRegistered = false;
function ensureVimBlockInsert() {
  if (vimBlockInsertRegistered) return;
  vimBlockInsertRegistered = true;

  Vim.defineAction("blockInsert", (cm: any) => {
    const vim = cm.state.vim;
    if (!vim?.visualBlock) return;

    const sel = vim.sel;
    const startLine = Math.min(sel.anchor.line, sel.head.line);
    const endLine   = Math.max(sel.anchor.line, sel.head.line);
    const startCh   = Math.min(sel.anchor.ch,   sel.head.ch);

    const view: EditorView = (cm as any).cm6;
    const doc = view.state.doc;
    const ranges = [];
    for (let line = startLine; line <= endLine; line++) {
      const lineInfo = doc.line(line + 1); // CM6 is 1-indexed
      const pos = lineInfo.from + Math.min(startCh, lineInfo.length);
      ranges.push(EditorSelection.cursor(pos));
    }

    view.dispatch({ selection: EditorSelection.create(ranges) });

    vim.visualMode  = false;
    vim.visualLine  = false;
    vim.visualBlock = false;
    vim.insertMode  = true;
    try { (cm as any).signal(cm, "vim-mode-change", { mode: "insert" }); } catch (_) {}
  });

  Vim.mapCommand("I", "action", "blockInsert", {}, { context: "visual" });
}

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

export default function Editor({ docId, value, onChange, editing, onExitEdit, editorTheme, vimMode = false, mermaidHandDrawn = false, placeholderText = "# タイトルを入力...", emptyNoteText = "ノートが空です" }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Set true before programmatic dispatch to suppress spurious onChange calls.
  const suppressChangeRef = useRef(false);
  const onExitEditRef = useRef(onExitEdit);
  onExitEditRef.current = onExitEdit;
  const vimModeRef = useRef(vimMode);
  vimModeRef.current = vimMode;
  const [vimModeLabel, setVimModeLabel] = useState<string>("NORMAL");

  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const url = a.getAttribute("href") ?? a.href;
    if (url) openUrl(url).catch(console.error);
  }, []);

  const escExt = useRef(
    keymap.of([{
      key: "Escape",
      run: () => { onExitEditRef.current?.(); return true; },
    }])
  );

  useEffect(() => {
    if (!containerRef.current) return;

    ensureVimExCommands(() => onExitEditRef.current?.());
    ensureVimBlockInsert();

    const state = EditorState.create({
      doc: value,
      extensions: [
        vimCompartment.of(vimMode ? vim() : []),
        escCompartment.of(vimMode ? [] : escExt.current),
        EditorState.allowMultipleSelections.of(true),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        drawSelection(),
        markdown({ codeLanguages: languages }),
        ...tagHighlighter,
        themeCompartment.of(resolveEditorTheme(editorTheme)),
        baseTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !suppressChangeRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        placeholderCompartment.of(placeholder(placeholderText)),
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

  // Swap placeholder text without recreating the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: placeholderCompartment.reconfigure(placeholder(placeholderText)) });
  }, [placeholderText]);

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
      suppressChangeRef.current = true;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      suppressChangeRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  useEffect(() => {
    if (editing) return;
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      suppressChangeRef.current = true;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
      suppressChangeRef.current = false;
    }
  }, [value, editing]);

  const previewHtml = useMemo(() => {
    if (editing) return "";
    return renderPreview(value, emptyNoteText);
  }, [value, editing, emptyNoteText]);

  useEffect(() => {
    if (editing || !previewHtml.includes('class="mermaid"')) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const accentColor = (document.documentElement.getAttribute("data-accent") ?? "blueberry") as AccentColor;
    const themeConfig = getMermaidThemeConfig(accentColor, isDark, mermaidHandDrawn);
    mermaid.initialize({
      startOnLoad: false,
      theme: themeConfig.theme,
      look: themeConfig.look ?? "classic",
      ...(themeConfig.themeVariables ? { themeVariables: themeConfig.themeVariables } : {}),
      securityLevel: "loose",
    });

    // Tag each .mermaid element before run() replaces text content with SVG
    const mermaidEls = document.querySelectorAll<HTMLElement>(".mermaid");
    mermaidEls.forEach((el) => {
      const code = el.textContent ?? "";
      const body = code.trimStart().replace(/^---[\s\S]*?---\s*/m, "");
      const native = /^(flowchart|graph|erDiagram|classDiagram|stateDiagram(?:-v2)?)[\s\n\r]/i.test(body.trimStart());
      el.dataset.isFlowchart = native ? "true" : "false";
    });

    mermaid.run({ querySelector: ".mermaid" }).then(async () => {
      const svgEls = Array.from(document.querySelectorAll<SVGSVGElement>(".mermaid svg"));

      if (!mermaidHandDrawn) {
        svgEls.forEach(normalizeSvgEl);
        return;
      }

      for (const svgEl of svgEls) {
        const container = svgEl.closest(".mermaid") as HTMLElement | null;
        if (!container) continue;

        if (container.dataset.isFlowchart === "true") {
          // Flowchart: mermaid native hand-drawn — just normalize
          normalizeSvgEl(svgEl);
          continue;
        }

        // Non-flowchart: run svg2roughjs with original dimensions intact,
        // then normalize the output. Normalizing before sketch() removes
        // width/height which causes svg2roughjs to miscalculate dimensions
        // for sequence, pie, quadrant and other diagram types.
        try {
          const converter = new Svg2Roughjs(container as HTMLDivElement);
          converter.svg = svgEl;
          converter.roughConfig = { roughness: 0.8, bowing: 0.5, fillStyle: "hachure" };
          converter.seed = 42;
          await converter.sketch();
          svgEl.remove();
          const newSvg = container.querySelector("svg");
          if (newSvg) normalizeSvgEl(newSvg);
        } catch (e) {
          console.warn("svg2roughjs failed, falling back to plain SVG:", e);
          normalizeSvgEl(svgEl);
        }
      }
    }).catch(console.error);
  }, [previewHtml, editing, mermaidHandDrawn]);

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
            onClick={handlePreviewClick}
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
