import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../src/theme";
import { useSettingsStore } from "../src/store/settingsStore";
import { getMermaidThemeConfig, type AccentColor } from "../src/mermaidThemes";

function buildHtml(code: string, isDark: boolean, accentColor: AccentColor, handDrawn: boolean): string {
  const themeConfig = getMermaidThemeConfig(accentColor, isDark, handDrawn);
  const bg = isDark ? "#161625" : themeConfig.themeVariables?.background ?? "#FAFAFE";
  const initConfig = JSON.stringify({
    startOnLoad: false,
    theme: themeConfig.theme,
    ...(themeConfig.look ? { look: themeConfig.look } : {}),
    ...(themeConfig.themeVariables ? { themeVariables: themeConfig.themeVariables } : {}),
    securityLevel: "loose",
  });
  const safe = code.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
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
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
</head>
<body>
<div id="wrap"></div>
<script>
mermaid.initialize(${initConfig});
(async () => {
  try {
    const { svg } = await mermaid.render('m', \`${safe}\`);
    document.getElementById('wrap').innerHTML = svg;
  } catch(e) {
    document.getElementById('wrap').innerHTML = '<div class="error">Diagram error: ' + e.message + '</div>';
  }
  window.ReactNativeWebView.postMessage(String(document.body.scrollHeight));
})();
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

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ html: buildHtml(code, isDark, accentColor, mermaidHandDrawn) }}
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
