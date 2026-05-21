import { ScrollView, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { useTheme } from "../src/theme";

type Props = {
  onInsertWrap: (before: string, after?: string) => void;
  onInsertLinePrefix: (prefix: string) => void;
};

const ITEMS = [
  { label: "B", before: "**", after: "**" },
  { label: "I", before: "*", after: "*" },
  { label: "`", before: "`", after: "`" },
  { label: "H1", linePrefix: "# " },
  { label: "H2", linePrefix: "## " },
  { label: "—", linePrefix: "- " },
  { label: "1.", linePrefix: "1. " },
  { label: "☐", linePrefix: "- [ ] " },
  { label: "```", before: "```\n", after: "\n```" },
] as const;

export default function MarkdownToolbar({ onInsertWrap, onInsertLinePrefix }: Props) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      style={[styles.toolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
      contentContainerStyle={styles.content}
    >
      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={[styles.btn, { borderColor: colors.border }]}
          onPress={() => {
            if ("linePrefix" in item) {
              onInsertLinePrefix(item.linePrefix);
            } else {
              onInsertWrap(item.before, item.after);
            }
          }}
        >
          <Text style={[styles.btnText, { color: colors.text }]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    flexGrow: 0,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontWeight: "600",
  },
});
