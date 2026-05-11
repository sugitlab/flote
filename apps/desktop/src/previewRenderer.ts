import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import json from "highlight.js/lib/languages/json";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import ruby from "highlight.js/lib/languages/ruby";
import swift from "highlight.js/lib/languages/swift";
import kotlin from "highlight.js/lib/languages/kotlin";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import { Marked } from "marked";
import type { MarkedExtension, Tokens } from "marked";
import DOMPurify from "dompurify";

import oneDarkCss       from "highlight.js/styles/atom-one-dark.min.css?inline";
import draculaCss       from "highlight.js/styles/base16/dracula.css?inline";
import nightOwlCss      from "highlight.js/styles/night-owl.min.css?inline";
import vsDarkCss        from "highlight.js/styles/vs2015.min.css?inline";
import githubCss        from "highlight.js/styles/github.min.css?inline";
import oneLightCss      from "highlight.js/styles/atom-one-light.min.css?inline";
import vsLightCss       from "highlight.js/styles/vs.min.css?inline";
import solarizedLightCss from "highlight.js/styles/base16/solarized-light.css?inline";

import type { EditorTheme } from "./editorThemes";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", json);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdown);

export const HLJS_THEME_CSS: Record<EditorTheme, string> = {
  oneDark:        oneDarkCss,
  dracula:        draculaCss,
  nightOwl:       nightOwlCss,
  vsDark:         vsDarkCss,
  github:         githubCss,
  oneLight:       oneLightCss,
  vsLight:        vsLightCss,
  solarizedLight: solarizedLightCss,
};

const TAG_RE = /^#([a-zA-Z぀-鿿][a-zA-Z0-9぀-鿿_-]*)/;

const hashtagExtension: MarkedExtension = {
  extensions: [
    {
      name: "hashtag",
      level: "inline",
      start(src: string) {
        return src.indexOf("#");
      },
      tokenizer(src: string) {
        const m = TAG_RE.exec(src);
        if (m) return { type: "hashtag", raw: m[0], tag: m[1] };
      },
      renderer(token: Tokens.Generic) {
        return `<span class="preview-hashtag"><span class="preview-hashtag-hash">#</span><span class="preview-hashtag-name">${token.tag}</span></span>`;
      },
    },
  ],
};

const previewMarked = new Marked(hashtagExtension, {
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs language-${language ?? "plaintext"}">${highlighted}</code></pre>`;
    },
  },
});

export function renderPreview(value: string): string {
  const raw = previewMarked.parse(value || "*ノートが空です*") as string;
  return DOMPurify.sanitize(raw);
}
