import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const host = process.env.TAURI_DEV_HOST;

// Serve Excalidraw font assets (209 Xiaolai WOFF2 chunks) from node_modules in dev,
// and copy them to dist/fonts/ for production builds so EXCALIDRAW_ASSET_PATH='/' resolves correctly.
function excalidrawFontsPlugin(): Plugin {
  const fontsSource = path.resolve(
    __dirname,
    "../../node_modules/@excalidraw/excalidraw/dist/dev/fonts"
  );

  return {
    name: "excalidraw-fonts",
    configureServer(server) {
      server.middlewares.use("/fonts", (req, res, next) => {
        const filePath = path.join(fontsSource, req.url || "");
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader("Content-Type", "font/woff2");
          res.end(fs.readFileSync(filePath));
        } else {
          next();
        }
      });
    },
    closeBundle() {
      // Only copy Xiaolai (CJK hand-drawn fallback) — other fonts load via CDN
      const xiaolaiSrc = path.join(fontsSource, "Xiaolai");
      const xiaolaiDest = path.resolve(__dirname, "dist/fonts/Xiaolai");
      if (!fs.existsSync(xiaolaiSrc)) return;
      copyDirSync(xiaolaiSrc, xiaolaiDest);
    },
  };
}

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

export default defineConfig(async () => ({
  plugins: [react(), excalidrawFontsPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
