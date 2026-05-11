import { ViewPlugin, Decoration, EditorView } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// Same pattern as utils/tags.ts — letter-start hashtags only (excludes #123, # header)
const TAG_RE = /#([a-zA-Z぀-鿿][a-zA-Z0-9぀-鿿_-]*)/g;

const hashDeco = Decoration.mark({ class: "cm-hashtag-hash" });
const nameDeco = Decoration.mark({ class: "cm-hashtag-name" });

function isInsideCode(view: EditorView, pos: number): boolean {
  let node = syntaxTree(view.state).resolveInner(pos, 1);
  // Walk up the parse tree; bail out on any code-related node
  for (;;) {
    if (node.name.includes("Code")) return true;
    if (!node.parent) return false;
    node = node.parent;
  }
}

function buildDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG_RE.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      if (isInsideCode(view, start + 1)) continue;
      builder.add(start, start + 1, hashDeco);
      builder.add(start + 1, end, nameDeco);
    }
  }
  return builder.finish();
}

const tagHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecos(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) {
        this.decorations = buildDecos(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const tagHighlightTheme = EditorView.baseTheme({
  ".cm-hashtag-hash": {
    color: "var(--accent)",
    fontWeight: "700",
    opacity: "0.6",
  },
  ".cm-hashtag-name": {
    color: "var(--accent)",
    fontWeight: "600",
  },
});

export const tagHighlighter = [tagHighlightPlugin, tagHighlightTheme];
