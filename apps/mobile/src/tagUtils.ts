const TAG_RE = /#([\w぀-龯一-鿿゠-ヿ]+)/g;

export function extractTags(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(text)) !== null) {
    found.add(m[1]);
  }
  return [...found];
}

export function allTags(items: { title?: string; body_md: string }[]): string[] {
  const found = new Set<string>();
  for (const item of items) {
    extractTags((item.title ?? "") + " " + item.body_md).forEach((t) => found.add(t));
  }
  return [...found].sort();
}
