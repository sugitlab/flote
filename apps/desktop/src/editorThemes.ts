import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";
import type { EditorTheme } from "./store/uiStore";

type ThemeColors = {
  bg: string;
  fg: string;
  cursor: string;
  selection: string;
  lineHighlight: string;
  heading: string;
  link: string;
  code: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  operator: string;
  dark: boolean;
};

function buildTheme(c: ThemeColors): Extension[] {
  const base = EditorView.theme(
    {
      "&": { backgroundColor: c.bg, color: c.fg },
      ".cm-content": { caretColor: c.cursor },
      "&.cm-focused .cm-cursor": { borderLeftColor: c.cursor },
      ".cm-activeLine": { backgroundColor: c.lineHighlight },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
        backgroundColor: c.selection,
      },
      ".cm-gutters": { backgroundColor: c.bg, borderRight: "none" },
    },
    { dark: c.dark }
  );

  const hl = syntaxHighlighting(
    HighlightStyle.define([
      { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], color: c.heading, fontWeight: "bold" },
      { tag: t.strong,        fontWeight: "bold" },
      { tag: t.emphasis,      fontStyle: "italic" },
      { tag: t.strikethrough, textDecoration: "line-through" },
      { tag: [t.link, t.url], color: c.link, textDecoration: "underline" },
      { tag: t.monospace,     color: c.code },
      { tag: t.quote,         color: c.comment, fontStyle: "italic" },
      { tag: t.keyword,                     color: c.keyword },
      { tag: [t.string, t.inserted],        color: c.string },
      { tag: [t.number, t.bool, t.null],    color: c.number },
      { tag: [t.operator, t.punctuation],   color: c.operator },
      { tag: t.comment,                     color: c.comment, fontStyle: "italic" },
      { tag: [t.variableName, t.propertyName], color: c.fg },
      { tag: [t.typeName, t.className],     color: c.heading },
      { tag: t.definition(t.variableName),  color: c.link },
      { tag: t.invalid,                     color: "#f00" },
    ])
  );

  return [base, hl];
}

// Colors derived from prism-react-renderer theme sources
const themes: Record<Exclude<EditorTheme, "oneDark">, Extension[]> = {
  dracula: buildTheme({
    dark: true,
    bg: "#282A36", fg: "#F8F8F2", cursor: "#F8F8F2",
    selection: "#44475a", lineHighlight: "#44475a33",
    heading:  "#bd93f9",         // purple
    link:     "#8be9fd",         // cyan
    code:     "#f1fa8c",         // yellow
    keyword:  "#ff79c6",         // pink
    string:   "#f1fa8c",
    comment:  "#6272a4",
    number:   "#bd93f9",
    operator: "#ff79c6",
  }),

  nightOwl: buildTheme({
    dark: true,
    bg: "#011627", fg: "#d6deeb", cursor: "#80a4c2",
    selection: "#1d3b53", lineHighlight: "#ffffff08",
    heading:  "#82aaff",         // blue
    link:     "#addb67",         // green
    code:     "#ecc48d",         // orange
    keyword:  "#c792ea",         // purple
    string:   "#ecc48d",
    comment:  "#637777",
    number:   "#f78c6c",
    operator: "#7fdbca",
  }),

  palenight: buildTheme({
    dark: true,
    bg: "#292d3e", fg: "#bfc7d5", cursor: "#bfc7d5",
    selection: "#343b51", lineHighlight: "#ffffff08",
    heading:  "#82aaff",         // blue
    link:     "#c3e88d",         // green
    code:     "#ffcb6b",         // yellow
    keyword:  "#c792ea",         // purple
    string:   "#c3e88d",
    comment:  "#697098",
    number:   "#f78c6c",
    operator: "#89ddff",
  }),

  vsDark: buildTheme({
    dark: true,
    bg: "#1E1E1E", fg: "#9CDCFE", cursor: "#aeafad",
    selection: "#264f78", lineHighlight: "#ffffff08",
    heading:  "#569cd6",         // VS blue
    link:     "#9CDCFE",
    code:     "#ce9178",         // string orange
    keyword:  "#569cd6",
    string:   "#ce9178",
    comment:  "#6a9955",
    number:   "#b5cea8",
    operator: "#d4d4d4",
  }),

  github: buildTheme({
    dark: false,
    bg: "#f6f8fa", fg: "#393A34", cursor: "#393A34",
    selection: "#0366d625", lineHighlight: "#f1f8ff",
    heading:  "#005cc5",         // blue
    link:     "#0366d6",
    code:     "#d73a49",         // red
    keyword:  "#d73a49",
    string:   "#032f62",         // dark blue
    comment:  "#6a737d",
    number:   "#005cc5",
    operator: "#393A34",
  }),

  oneLight: buildTheme({
    dark: false,
    bg: "hsl(230,1%,98%)", fg: "hsl(230,8%,24%)", cursor: "hsl(230,8%,24%)",
    selection: "#e5e5e9", lineHighlight: "#f0f0f2",
    heading:  "hsl(221,87%,60%)",   // blue
    link:     "hsl(221,87%,60%)",
    code:     "hsl(5,74%,59%)",     // red
    keyword:  "hsl(301,63%,40%)",   // purple
    string:   "hsl(119,34%,47%)",   // green
    comment:  "hsl(230,4%,64%)",
    number:   "hsl(35,99%,36%)",    // orange
    operator: "hsl(230,8%,24%)",
  }),

  vsLight: buildTheme({
    dark: false,
    bg: "#ffffff", fg: "#000000", cursor: "#000000",
    selection: "#add6ff", lineHighlight: "#f5f5f5",
    heading:  "#0000ff",
    link:     "#0070c1",
    code:     "#a31515",         // red (string)
    keyword:  "#0000ff",
    string:   "#a31515",
    comment:  "#008000",
    number:   "#098658",
    operator: "#000000",
  }),
};

export function resolveEditorTheme(name: EditorTheme = "oneDark"): Extension[] {
  if (name === "oneDark") return [oneDark] as Extension[];
  return themes[name];
}
