import { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { useTheme } from "../src/theme";
import { useSettingsStore } from "../src/store/settingsStore";
import { getMermaidThemeConfig, type AccentColor } from "../src/mermaidThemes";

// Load JS assets from bundled files once and cache in memory
let _roughJs: string | null = null;
let _mermaidJs: string | null = null;
let _assetsPromise: Promise<void> | null = null;

function loadAssets(): Promise<void> {
  if (_mermaidJs && _roughJs) return Promise.resolve();
  if (_assetsPromise) return _assetsPromise;
  _assetsPromise = Promise.all([
    Asset.fromModule(require("../assets/rough-4.txt"))
      .downloadAsync()
      .then((a) => FileSystem.readAsStringAsync(a.localUri!))
      .then((c) => { _roughJs = c; }),
    Asset.fromModule(require("../assets/mermaid-11.15.0.txt"))
      .downloadAsync()
      .then((a) => FileSystem.readAsStringAsync(a.localUri!))
      .then((c) => { _mermaidJs = c; }),
  ]).then(() => {});
  return _assetsPromise;
}

function buildHtml(
  code: string,
  isDark: boolean,
  accentColor: AccentColor,
  handDrawn: boolean,
  roughJs: string,
  mermaidJs: string
): string {
  const themeConfig = getMermaidThemeConfig(accentColor, isDark, handDrawn);
  const bg = isDark ? "#161625" : (themeConfig.themeVariables?.background ?? "#FAFAFE");
  const initConfig = JSON.stringify({
    startOnLoad: false,
    theme: themeConfig.theme,
    look: themeConfig.look ?? "classic",
    htmlLabels: false,
    ...(themeConfig.themeVariables ? { themeVariables: themeConfig.themeVariables } : {}),
    securityLevel: "loose",
  });
  // Inject look:handDrawn via frontmatter when handDrawn is enabled.
  // This bypasses initialize() config and avoids dynamic import issues on Android WebView.
  const codeWithLook = handDrawn && !code.trimStart().startsWith("---")
    ? `---\nconfig:\n  look: handDrawn\n---\n${code}`
    : code;
  const safe = codeWithLook.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  // Escape </script> inside the inlined JS to prevent early tag close
  const safeRoughJs = roughJs.replace(/<\/script>/gi, "<\\/script>");
  const safeMermaidJs = mermaidJs.replace(/<\/script>/gi, "<\\/script>");
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:${bg}; overflow:hidden; }
  #wrap { display:flex; align-items:center; justify-content:center; min-height:10px; }
  svg { max-width:100%; height:auto; display:block; }
  .error { color:#f03e3e; font-size:13px; font-family:monospace; padding:8px; }
</style>
<script>${safeRoughJs}</script>
<script>${safeMermaidJs}</script>
</head>
<body>
<div id="wrap"></div>
<script>
mermaid.initialize(${initConfig});
setTimeout(async () => {
  const cfg = mermaid.getConfig ? mermaid.getConfig() : {};
  const diag = {
    look: cfg.look,
    theme: cfg.theme,
    htmlLabels: cfg.htmlLabels,
    version: mermaid.version ?? 'unknown',
    roughGlobal: typeof rough !== 'undefined',
  };
  window.ReactNativeWebView.postMessage('DIAG:' + JSON.stringify(diag));
  try {
    const { svg } = await mermaid.render('m', \`${safe}\`);
    document.getElementById('wrap').innerHTML = svg;
    window.ReactNativeWebView.postMessage('SVG:' + JSON.stringify({
      len: svg.length,
      hasRough: svg.includes('rough'),
      hasTurbulence: svg.includes('feTurbulence'),
    }));
  } catch(e) {
    document.getElementById('wrap').innerHTML = '<div class="error">Diagram error: ' + e.message + '</div>';
    window.ReactNativeWebView.postMessage('ERR:' + e.message);
  }
  window.ReactNativeWebView.postMessage('HEIGHT:' + String(document.body.scrollHeight));
}, 50);
</script>
</body>
</html>`;
}

type Props = { code: string };

export default function MermaidChart({ code }: Props) {
  const { isDark } = useTheme();
  const accentColor = useSettingsStore((s) => s.accentColor) as AccentColor;
  const mermaidHandDrawn = useSettingsStore((s) => s.mermaidHandDrawn);
  const [height, setHeight] = useState(160);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [diagLog, setDiagLog] = useState<string[]>([]);

  useEffect(() => {
    loadAssets().then(() => setAssetsLoaded(true)).catch(() => setAssetsLoaded(true));
  }, []);

  if (!assetsLoaded) {
    return <View style={[styles.wrap, { height: 160 }]} />;
  }

  return (
    <View>
      <View style={[styles.wrap, { height }]}>
      <WebView
        key={`${isDark}-${accentColor}-${mermaidHandDrawn}`}
        source={{ html: buildHtml(code, isDark, accentColor, mermaidHandDrawn, _roughJs!, _mermaidJs!) }}
        style={styles.web}
        scrollEnabled={false}
        originWhitelist={["*"]}
        onMessage={(e) => {
          const msg = e.nativeEvent.data;
          if (msg.startsWith("HEIGHT:")) {
            const h = parseInt(msg.slice(7), 10);
            if (!isNaN(h) && h > 0) setHeight(h + 8);
          } else {
            setDiagLog((prev) => [...prev, msg]);
          }
        }}
      />
      </View>
      {diagLog.length > 0 && (
        <View style={styles.diagBox}>
          {diagLog.map((line, i) => (
            <Text key={i} selectable style={styles.diagText}>{line}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginVertical: 8, borderRadius: 8, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
  diagBox: { backgroundColor: "#1a1a2e", padding: 8, borderRadius: 6, marginBottom: 8, gap: 2 },
  diagText: { color: "#00ff88", fontSize: 10, fontFamily: "monospace" },
});
