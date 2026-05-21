import { useRef, useCallback, useEffect } from "react";
import type { TextInput } from "react-native";

type Selection = { start: number; end: number };

export function useMarkdownInput(
  value: string,
  onChange: (text: string) => void,
  inputRef: React.RefObject<TextInput | null>
) {
  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  const prevValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current !== null) clearTimeout(timerRef.current); }, []);

  const handleSelectionChange = useCallback(
    (e: { nativeEvent: { selection: Selection } }) => {
      selectionRef.current = e.nativeEvent.selection;
    },
    []
  );

  // Set cursor position imperatively after the text-change render settles.
  // Using setNativeProps avoids the two-render flash that the `selection` prop causes.
  const applySelection = useCallback(
    (sel: Selection) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        inputRef.current?.setNativeProps({ selection: sel });
        selectionRef.current = sel;
        timerRef.current = null;
      }, 0);
    },
    [inputRef]
  );

  const handleChangeText = useCallback(
    (text: string) => {
      const prev = prevValueRef.current;
      prevValueRef.current = text;

      if (text.length === prev.length + 1) {
        const insertPos = selectionRef.current.start;
        if (insertPos >= 0 && insertPos < text.length && text[insertPos] === "\n") {
          const lineStart = text.lastIndexOf("\n", insertPos - 1) + 1;
          const line = text.slice(lineStart, insertPos);

          // Checkbox: - [ ] or - [x]
          const checkboxMatch = line.match(/^(\s*)(- \[[ x]\] )(.*)/);
          if (checkboxMatch) {
            const [, indent, , content] = checkboxMatch;
            if (!content.trim()) {
              const newText = text.slice(0, lineStart) + indent + text.slice(insertPos + 1);
              prevValueRef.current = newText;
              onChange(newText);
              applySelection({ start: lineStart + indent.length, end: lineStart + indent.length });
              return;
            }
            const prefix = indent + "- [ ] ";
            const newText = text.slice(0, insertPos + 1) + prefix + text.slice(insertPos + 1);
            prevValueRef.current = newText;
            onChange(newText);
            applySelection({ start: insertPos + 1 + prefix.length, end: insertPos + 1 + prefix.length });
            return;
          }

          // Bullet: - (not checkbox)
          const bulletMatch = line.match(/^(\s*)(- )(.*)/);
          if (bulletMatch) {
            const [, indent, , content] = bulletMatch;
            if (!content.trim()) {
              const newText = text.slice(0, lineStart) + indent + text.slice(insertPos + 1);
              prevValueRef.current = newText;
              onChange(newText);
              applySelection({ start: lineStart + indent.length, end: lineStart + indent.length });
              return;
            }
            const prefix = indent + "- ";
            const newText = text.slice(0, insertPos + 1) + prefix + text.slice(insertPos + 1);
            prevValueRef.current = newText;
            onChange(newText);
            applySelection({ start: insertPos + 1 + prefix.length, end: insertPos + 1 + prefix.length });
            return;
          }

          // Numbered list
          const numberedMatch = line.match(/^(\s*)(\d+)\. (.*)/);
          if (numberedMatch) {
            const [, indent, num, content] = numberedMatch;
            if (!content.trim()) {
              const newText = text.slice(0, lineStart) + indent + text.slice(insertPos + 1);
              prevValueRef.current = newText;
              onChange(newText);
              applySelection({ start: lineStart + indent.length, end: lineStart + indent.length });
              return;
            }
            const nextMarker = `${parseInt(num, 10) + 1}. `;
            const prefix = indent + nextMarker;
            const newText = text.slice(0, insertPos + 1) + prefix + text.slice(insertPos + 1);
            prevValueRef.current = newText;
            onChange(newText);
            applySelection({ start: insertPos + 1 + prefix.length, end: insertPos + 1 + prefix.length });
            return;
          }
        }
      }

      onChange(text);
    },
    [onChange, applySelection]
  );

  // Wrap selected text (or insert at cursor) with before/after markers.
  // Without selection: cursor lands between before and after.
  const insertAtCursor = useCallback(
    (before: string, after = "") => {
      const { start, end } = selectionRef.current;
      const selected = value.slice(start, end);
      const newText = value.slice(0, start) + before + selected + after + value.slice(end);
      prevValueRef.current = newText;
      onChange(newText);
      const newCursor = selected.length > 0
        ? start + before.length + selected.length + after.length
        : start + before.length;
      applySelection({ start: newCursor, end: newCursor });
    },
    [value, onChange, applySelection]
  );

  // Toggle a line-level prefix (e.g. "- ", "# ") at the start of the cursor's line
  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const { start } = selectionRef.current;
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", start);
      const end = lineEnd === -1 ? value.length : lineEnd;
      const line = value.slice(lineStart, end);

      if (line.startsWith(prefix)) {
        const newText = value.slice(0, lineStart) + line.slice(prefix.length) + value.slice(end);
        prevValueRef.current = newText;
        onChange(newText);
        applySelection({ start: Math.max(lineStart, start - prefix.length), end: Math.max(lineStart, start - prefix.length) });
      } else {
        const newText = value.slice(0, lineStart) + prefix + line + value.slice(end);
        prevValueRef.current = newText;
        onChange(newText);
        applySelection({ start: start + prefix.length, end: start + prefix.length });
      }
    },
    [value, onChange, applySelection]
  );

  return {
    handleChangeText,
    handleSelectionChange,
    insertAtCursor,
    insertLinePrefix,
  };
}
