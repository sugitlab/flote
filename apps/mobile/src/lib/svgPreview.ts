// Excalidraw SVG previews are stored in the note-files Storage bucket
// (referenced from body_md as `svg_ref`) instead of inline — keeping them
// inline roughly doubled the notes row size on every save.
// Downloads are cached on disk keyed by the note's updated_at.
import { supabase } from "./supabase";
import { readJson, writeJson } from "./fsCache";

type SvgEntry = { svg: string; updated_at: string };

function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  // React Native's Blob lacks .text() — fall back to FileReader
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

export async function fetchSvgPreview(
  noteId: string,
  svgRef: string,
  updatedAt: string
): Promise<string> {
  const cacheName = `note-svg-${noteId}.json`;
  const cached = await readJson<SvgEntry>(cacheName);
  if (cached && cached.updated_at === updatedAt) return cached.svg;
  try {
    const { data, error } = await supabase.storage.from("note-files").download(svgRef);
    if (error || !data) return cached?.svg ?? "";
    const svg = await blobToText(data);
    if (svg) void writeJson(cacheName, { svg, updated_at: updatedAt });
    return svg;
  } catch {
    return cached?.svg ?? "";
  }
}
