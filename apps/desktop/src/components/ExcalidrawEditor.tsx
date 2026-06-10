import { useState, useRef, useCallback, useEffect } from "react";
import { Excalidraw, exportToSvg, serializeAsJSON, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { Note } from "@flote/types";
import { useUIStore } from "../store/uiStore";

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
  const setSuppressHideOnBlur = useUIStore((s) => s.setSuppressHideOnBlur);

  useEffect(() => {
    setTitle(note.title);
  }, [note.id, note.title]);

  const handleExport = async () => {
    const api = apiRef.current;
    if (!api) return;
    const safeName = (title || "drawing").replace(/[/\\?%*:|"<>]/g, "-");
    setSuppressHideOnBlur(true);
    try {
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
    } finally {
      setSuppressHideOnBlur(false);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setTitle(v);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => onSave({ title: v }), 2000);
  };

  const initialData = parseExcalidrawBody(note.body_md);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: any, appState: any, files: any) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // AppState contains non-serializable values (Map, functions, etc.)
        // so only persist the safe subset needed to restore the view.
        const safeAppState = {
          viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff",
          zoom: appState.zoom,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        };
        const hasEmbeddedImages = Object.keys(files ?? {}).length > 0;
        const doSave = async () => {
          let svg = "";
          if (!hasEmbeddedImages) {
            // Drawings without embedded images: generate SVG for mobile preview.
            // Drawings with images: SVG would duplicate all base64 data (doubling
            // storage size), so skip SVG — mobile shows a "desktop only" message.
            try {
              const svgEl = await exportToSvg({ elements, appState, files: {} });
              svg = svgEl.outerHTML;
            } catch {
              // ignore — mobile preview falls back to "desktop only"
            }
          }
          const body: ExcalidrawNoteBody = { elements, appState: safeAppState, files, svg };
          onSave({ body_md: JSON.stringify(body) });
        };
        doSave();
      }, 2000);
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
        }}
      >
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="タイトルを入力..."
          style={{
            width: "100%",
            background: "none",
            border: "none",
            outline: "none",
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            fontFamily: "inherit",
          }}
        />
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
        >
          <MainMenu>
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.Separator />
            <MainMenu.Item
              onSelect={handleExport}
            >
              Export as .excalidraw
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.Socials />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
      </div>
    </div>
  );
}
