import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { useTheme } from "../src/theme";
import { useSettingsStore } from "../src/store/settingsStore";
import { getMermaidThemeConfig, type AccentColor } from "../src/mermaidThemes";

// Load mermaid JS from bundled asset once and cache in memory
let _mermaidJs: string | null = null;
let _mermaidJsPromise: Promise<string> | null = null;

function getMermaidJs(): Promise<string> {
  if (_mermaidJs) return Promise.resolve(_mermaidJs);
  if (_mermaidJsPromise) return _mermaidJsPromise;
  _mermaidJsPromise = Asset.fromModule(require("../assets/mermaid-11.15.0.txt"))
    .downloadAsync()
    .then((asset) => FileSystem.readAsStringAsync(asset.localUri!))
    .then((content) => {
      _mermaidJs = content;
      return content;
    });
  return _mermaidJsPromise;
}

function buildHtml(
  code: string,
  isDark: boolean,
  accentColor: AccentColor,
  handDrawn: boolean,
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
  const safe = code.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  // Escape </script> inside the inlined JS to prevent early tag close
  const safeJs = mermaidJs.replace(/<\/script>/gi, "<\\/script>");
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
<script>${safeJs}</script>
</head>
<body>
<div id="wrap"></div>
<script>
mermaid.initialize(${initConfig});
// Small delay to ensure initialize completes before render on Android WebView
setTimeout(async () => {
  try {
    const { svg } = await mermaid.render('m', \`${safe}\`);
    document.getElementById('wrap').innerHTML = svg;
  } catch(e) {
    document.getElementById('wrap').innerHTML = '<div class="error">Diagram error: ' + e.message + '</div>';
  }
  window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
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
  const [mermaidJs, setMermaidJs] = useState<string | null>(null);

  useEffect(() => {
    getMermaidJs().then(setMermaidJs).catch(() => setMermaidJs(""));
  }, []);

  if (!mermaidJs) {
    return <View style={[styles.wrap, { height: 160 }]} />;
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        key={`${isDark}-${accentColor}-${mermaidHandDrawn}`}
        source={{ html: buildHtml(code, isDark, accentColor, mermaidHandDrawn, mermaidJs) }}
        style={styles.web}
        scrollEnabled={false}
        originWhitelist={["*"]}
        onMessage={(e) => {
          const h = parseInt(e.nativeEvent.data, 10);
          if (!isNaN(h) && h > 0) setHeight(h + 8);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginVertical: 8, borderRadius: 8, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
