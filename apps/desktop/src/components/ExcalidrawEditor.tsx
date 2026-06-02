import { useState, useRef, useCallback, useEffect } from "react";
import { Excalidraw, exportToSvg, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Note } from "@flote/types";

export type ExcalidrawNoteBody = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  elements: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appState: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  files: Record<string, any>;
  svg: string;
};

export function parseExcalidrawBody(body_md: string): ExcalidrawNoteBody {
  try {
    const parsed = JSON.parse(body_md);
    return {
      elements: parsed.elements ?? [],
      appState: parsed.appState ?? { viewBackgroundColor: "#ffffff" },
      files: parsed.files ?? {},
      svg: parsed.svg ?? "",
    };
  } catch {
    return { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {}, svg: "" };
  }
}

type Props = {
  note: Note;
  onSave: (updates: { title?: string; body_md?: string }) => void;
  isDark: boolean;
};

export default function ExcalidrawEditor({ note, onSave, isDark }: Props) {
  const [title, setTitle] = useState(note.title);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);

  useEffect(() => {
    setTitle(note.title);
  }, [note.id, note.title]);

  const handleExport = async () => {
    const api = apiRef.current;
    if (!api) return;
    const safeName = (title || "drawing").replace(/[/\\?%*:|"<>]/g, "-");
    const dest = await saveDialog({
      defaultPath: `${safeName}.excalidraw`,
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
    }).catch(() => null);
    if (!dest) return;
    const json = serializeAsJSON(
      api.getSceneElements(),
      api.getAppState(),
      api.getFiles(),
      "local"
    );
    await writeTextFile(dest, json);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => onSave({ title: v }), 500);
  };

  const initialData = parseExcalidrawBody(note.body_md);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: any, appState: any, files: any) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        // AppState contains non-serializable values (Map, functions, etc.)
        // so only persist the safe subset needed to restore the view.
        const safeAppState = {
          viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        };
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const svgEl = await exportToSvg({ elements, appState: safeAppState, files } as any);
          const svg = new XMLSerializer().serializeToString(svgEl);
          const body: ExcalidrawNoteBody = { elements, appState: safeAppState, files, svg };
          onSave({ body_md: JSON.stringify(body) });
        } catch (e) {
          console.warn("[ExcalidrawEditor] exportToSvg failed:", e);
          const body: ExcalidrawNoteBody = { elements, appState: safeAppState, files, svg: "" };
          onSave({ body_md: JSON.stringify(body) });
        }
      }, 600);
    },
    [onSave]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="タイトルを入力..."
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
        <button
          onClick={handleExport}
          title=".excalidraw 形式でエクスポート"
          style={{
            flexShrink: 0,
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Export ↓
        </button>
      </div>
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Excalidraw
          key={note.id}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialData={initialData as any}
          excalidrawAPI={(api) => { apiRef.current = api; }}
          onChange={handleChange}
          theme={isDark ? "dark" : "light"}
          UIOptions={{
            canvasActions: {
              export: false,
              loadScene: false,
              saveAsImage: true,
              saveToActiveFile: false,
            },
          }}
        />
      </div>
    </div>
  );
}
