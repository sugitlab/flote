import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../src/theme";

function buildHtml(code: string, isDark: boolean): string {
  const bg = isDark ? "#161625" : "#FAFAFE";
  const theme = isDark ? "dark" : "default";
  // Escape backticks in mermaid code so the template literal is safe
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
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
<div id="wrap"></div>
<script>
mermaid.initialize({ startOnLoad:false, theme:'${theme}', securityLevel:'loose' });
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
  const [height, setHeight] = useState(160);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        source={{ html: buildHtml(code, isDark) }}
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
