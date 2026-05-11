const TAG_RE = /#([a-zA-Z぀-鿿][a-zA-Z0-9぀-鿿_-]*)/g;

export function extractTags(bodyMd: string): string[] {
  const matches = [...bodyMd.matchAll(TAG_RE)].map((m) => m[1]);
  return [...new Set(matches)];
}

export function allTagsFromNotes(notes: { body_md: string }[]): string[] {
  const all = notes.flatMap((n) => extractTags(n.body_md));
  return [...new Set(all)].sort();
}

export function allTagsFromTasks(tasks: { body_md: string }[]): string[] {
  const all = tasks.flatMap((t) => extractTags(t.body_md));
  return [...new Set(all)].sort();
}
