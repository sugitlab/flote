import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";
import type { DarkEditorTheme, LightEditorTheme } from "./store/uiStore";

export type EditorTheme = DarkEditorTheme | LightEditorTheme;

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
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: c.selection,
      },
      ".cm-content ::selection": {
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

const oneDarkCustom: Extension[] = [
  EditorView.theme(
    {
      "&": { backgroundColor: "#282c34", color: "#abb2bf" },
      ".cm-content": { caretColor: "#528bff" },
      "&.cm-focused .cm-cursor": { borderLeftColor: "#528bff" },
      ".cm-activeLine": { backgroundColor: "#2c313a" },
      "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "#1d538c",
      },
      ".cm-gutters": { backgroundColor: "#282c34", borderRight: "none" },
    },
    { dark: true }
  ),
  syntaxHighlighting(oneDarkHighlightStyle),
];

const darkThemes: Record<DarkEditorTheme, Extension[]> = {
  oneDark: oneDarkCustom,
  dracula: buildTheme({
    dark: true,
    bg: "#282A36", fg: "#F8F8F2", cursor: "#F8F8F2",
    selection: "#6272a4", lineHighlight: "#44475a55",
    heading:  "#bd93f9",
    link:     "#8be9fd",
    code:     "#f1fa8c",
    keyword:  "#ff79c6",
    string:   "#f1fa8c",
    comment:  "#6272a4",
    number:   "#bd93f9",
    operator: "#ff79c6",
  }),

  nightOwl: buildTheme({
    dark: true,
    bg: "#011627", fg: "#d6deeb", cursor: "#80a4c2",
    selection: "#1d538c", lineHighlight: "#ffffff10",
    heading:  "#82aaff",
    link:     "#addb67",
    code:     "#ecc48d",
    keyword:  "#c792ea",
    string:   "#ecc48d",
    comment:  "#637777",
    number:   "#f78c6c",
    operator: "#7fdbca",
  }),

  vsDark: buildTheme({
    dark: true,
    bg: "#1E1E1E", fg: "#9CDCFE", cursor: "#aeafad",
    selection: "#3a6fa8", lineHighlight: "#ffffff10",
    heading:  "#569cd6",
    link:     "#9CDCFE",
    code:     "#ce9178",
    keyword:  "#569cd6",
    string:   "#ce9178",
    comment:  "#6a9955",
    number:   "#b5cea8",
    operator: "#d4d4d4",
  }),
};

const lightThemes: Record<LightEditorTheme, Extension[]> = {
  github: buildTheme({
    dark: false,
    bg: "#f6f8fa", fg: "#393A34", cursor: "#393A34",
    selection: "#0366d625", lineHighlight: "#f1f8ff",
    heading:  "#005cc5",
    link:     "#0366d6",
    code:     "#d73a49",
    keyword:  "#d73a49",
    string:   "#032f62",
    comment:  "#6a737d",
    number:   "#005cc5",
    operator: "#393A34",
  }),

  oneLight: buildTheme({
    dark: false,
    bg: "hsl(230,1%,98%)", fg: "hsl(230,8%,24%)", cursor: "hsl(230,8%,24%)",
    selection: "#e5e5e9", lineHighlight: "#f0f0f2",
    heading:  "hsl(221,87%,60%)",
    link:     "hsl(221,87%,60%)",
    code:     "hsl(5,74%,59%)",
    keyword:  "hsl(301,63%,40%)",
    string:   "hsl(119,34%,47%)",
    comment:  "hsl(230,4%,64%)",
    number:   "hsl(35,99%,36%)",
    operator: "hsl(230,8%,24%)",
  }),

  vsLight: buildTheme({
    dark: false,
    bg: "#ffffff", fg: "#000000", cursor: "#000000",
    selection: "#add6ff", lineHighlight: "#f5f5f5",
    heading:  "#0000ff",
    link:     "#0070c1",
    code:     "#a31515",
    keyword:  "#0000ff",
    string:   "#a31515",
    comment:  "#008000",
    number:   "#098658",
    operator: "#000000",
  }),

  solarizedLight: buildTheme({
    dark: false,
    bg: "#fdf6e3", fg: "#657b83", cursor: "#657b83",
    selection: "#eee8d5", lineHighlight: "#eee8d533",
    heading:  "#268bd2",
    link:     "#268bd2",
    code:     "#2aa198",
    keyword:  "#859900",
    string:   "#2aa198",
    comment:  "#93a1a1",
    number:   "#d33682",
    operator: "#657b83",
  }),
};

export function resolveEditorTheme(name: EditorTheme = "oneDark"): Extension[] {
  if (name in darkThemes) return darkThemes[name as DarkEditorTheme];
  return lightThemes[name as LightEditorTheme];
}
