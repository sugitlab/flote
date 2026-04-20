import { getCurrentWindow } from "@tauri-apps/api/window";

const HANDLE = 6; // px width of resize zone

const directions = [
  { cursor: "n-resize", dir: "North", style: { top: 0, left: HANDLE, right: HANDLE, height: HANDLE } },
  { cursor: "s-resize", dir: "South", style: { bottom: 0, left: HANDLE, right: HANDLE, height: HANDLE } },
  { cursor: "w-resize", dir: "West", style: { top: HANDLE, bottom: HANDLE, left: 0, width: HANDLE } },
  { cursor: "e-resize", dir: "East", style: { top: HANDLE, bottom: HANDLE, right: 0, width: HANDLE } },
  { cursor: "nw-resize", dir: "NorthWest", style: { top: 0, left: 0, width: HANDLE, height: HANDLE } },
  { cursor: "ne-resize", dir: "NorthEast", style: { top: 0, right: 0, width: HANDLE, height: HANDLE } },
  { cursor: "sw-resize", dir: "SouthWest", style: { bottom: 0, left: 0, width: HANDLE, height: HANDLE } },
  { cursor: "se-resize", dir: "SouthEast", style: { bottom: 0, right: 0, width: HANDLE, height: HANDLE } },
] as const;

export default function ResizeHandles() {
  return (
    <>
      {directions.map(({ cursor, dir, style }) => (
        <div
          key={dir}
          style={{
            position: "fixed",
            zIndex: 9999,
            cursor,
            ...style,
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            getCurrentWindow().startResizeDragging(dir);
          }}
        />
      ))}
    </>
  );
}
