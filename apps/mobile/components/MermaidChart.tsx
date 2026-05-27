import { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { useTheme } from "../src/theme";
import { useSettingsStore } from "../src/store/settingsStore";
import { getMermaidThemeConfig, type AccentColor } from "../src/mermaidThemes";

let _mermaidJs: string | null = null;
let _svg2roughJs: string | null = null;
let _assetsPromise: Promise<void> | null = null;

function loadAssets(): Promise<void> {
  if (_mermaidJs && _svg2roughJs) return Promise.resolve();
  if (_assetsPromise) return _assetsPromise;
  _assetsPromise = Promise.all([
    Asset.fromModule(require("../assets/mermaid-11.15.0.txt"))
      .downloadAsync()
      .then((a) => FileSystem.readAsStringAsync(a.localUri!))
      .then((c) => { _mermaidJs = c; }),
    Asset.fromModule(require("../assets/svg2roughjs-3.2.1.txt"))
      .downloadAsync()
      .then((a) => FileSystem.readAsStringAsync(a.localUri!))
      .then((c) => { _svg2roughJs = c; }),
  ]).then(() => {});
  return _assetsPromise;
}

// These diagram types use rough.js natively via mermaid's look:"handDrawn"
function isNativeHandDrawn(code: string): boolean {
  let body = code.trimStart();
  if (body.startsWith("---")) {
    const end = body.indexOf("---", 3);
    body = end >= 0 ? body.slice(end + 3).trimStart() : body;
  }
  return /^(flowchart|graph|erDiagram|classDiagram|stateDiagram(?:-v2)?)[\s\n\r]/i.test(body);
}

function buildHtml(
  code: string,
  isDark: boolean,
  accentColor: AccentColor,
  handDrawn: boolean,
  mermaidJs: string,
  svg2roughJs: string
): string {
  const useNativeHandDrawn = handDrawn && isNativeHandDrawn(code);
  const useSvg2rough = handDrawn && !useNativeHandDrawn;

  const themeConfig = getMermaidThemeConfig(accentColor, isDark, useNativeHandDrawn);
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
  const safeMermaidJs = mermaidJs.replace(/<\/script>/gi, "<\\/script>");
  const safeSvg2roughJs = svg2roughJs.replace(/<\/script>/gi, "<\\/script>");

  const roughScript = useSvg2rough ? `
    try {
      const Svg2Roughjs = svg2roughjs.Svg2Roughjs;
      const svgEl = document.querySelector('#wrap svg');
      if (svgEl) {
        const roughConverter = new Svg2Roughjs('#wrap');
        roughConverter.svg = svgEl;
        roughConverter.roughConfig = { roughness: 0.8, bowing: 0.5, fillStyle: 'hachure' };
        roughConverter.seed = 42;
        await roughConverter.sketch();
        svgEl.remove(); // remove original; sketch() appended the rough SVG
      }
    } catch(re) {
      // svg2roughjs failed — fall back to plain SVG silently
    }
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; overflow-x:hidden; background:${bg}; }
  #wrap { width:100%; }
  svg { display:block; max-width:100%; }
  .error { color:#f03e3e; font-size:13px; font-family:monospace; padding:8px; }
</style>
<script>${safeSvg2roughJs}</script>
<script>${safeMermaidJs}</script>
</head>
<body>
<div id="wrap"></div>
<script>
function normalizeSvg(svg) {
  if (!svg) return;
  if (!svg.getAttribute('viewBox')) {
    const w = parseFloat(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
    const h = parseFloat(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
    if (w && h) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.removeProperty('max-width');
  // Contain scaling: fill width, but cap height at 75vh
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    const vw = parts[2], vh = parts[3];
    if (vw > 0 && vh > 0) {
      const maxW = document.body.clientWidth;
      const maxH = window.innerHeight * 0.5;
      const scale = Math.min(maxW / vw, maxH / vh);
      svg.style.width = (vw * scale) + 'px';
      svg.style.height = (vh * scale) + 'px';
    }
  }
}
mermaid.initialize(${initConfig});
setTimeout(async () => {
  try {
    const { svg } = await mermaid.render('m', \`${safe}\`);
    document.getElementById('wrap').innerHTML = svg;
    ${useSvg2rough ? `${roughScript}
    normalizeSvg(document.querySelector('#wrap svg'));` : `normalizeSvg(document.querySelector('#wrap svg'));`}
  } catch(e) {
    document.getElementById('wrap').innerHTML = '<div class="error">Diagram error: ' + e.message + '</div>';
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

  useEffect(() => {
    loadAssets().then(() => setAssetsLoaded(true)).catch(() => setAssetsLoaded(true));
  }, []);

  if (!assetsLoaded) {
    return <View style={[styles.wrap, { height: 160 }]} />;
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        key={`${isDark}-${accentColor}-${mermaidHandDrawn}`}
        source={{ html: buildHtml(code, isDark, accentColor, mermaidHandDrawn, _mermaidJs!, _svg2roughJs!) }}
        style={styles.web}
        scrollEnabled={false}
        originWhitelist={["*"]}
        onMessage={(e) => {
          const msg = e.nativeEvent.data;
          if (msg.startsWith("HEIGHT:")) {
            const h = parseInt(msg.slice(7), 10);
            if (!isNaN(h) && h > 0) setHeight(h + 8);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", marginVertical: 8, borderRadius: 8, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
