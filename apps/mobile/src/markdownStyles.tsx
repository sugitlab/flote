import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "./theme";
import CodeBlock from "../components/CodeBlock";

export function makeMarkdownStyles(colors: ThemeColors) {
  return {
    body: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 24,
      overflow: "visible" as const,
      fontFamily: "NotoSansJP_400Regular",
    },
    heading1: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 36,
      fontFamily: "NotoSansJP_700Bold",
      marginTop: 0,
      marginBottom: 10,
      paddingTop: 0,
      overflow: "visible" as const,
    },
    heading2: {
      color: colors.text,
      fontSize: 22,
      fontFamily: "NotoSansJP_700Bold",
      marginTop: 18,
      marginBottom: 6,
    },
    heading3: {
      color: colors.text,
      fontSize: 18,
      fontFamily: "NotoSansJP_600SemiBold",
      marginTop: 14,
      marginBottom: 4,
    },
    heading4: {
      color: colors.text,
      fontSize: 16,
      fontFamily: "NotoSansJP_600SemiBold",
      marginTop: 10,
      marginBottom: 4,
    },
    paragraph: { color: colors.text, marginVertical: 4 },
    link: { color: colors.accent },
    strong: { fontFamily: "NotoSansJP_700Bold" },
    em: { fontStyle: "italic" as const, color: colors.textSecondary },

    // Code
    code_inline: {
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontSize: 13,
    },
    code_block: {
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 13,
      marginVertical: 8,
    },
    fence: {
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 13,
      marginVertical: 8,
    },

    // Blockquote
    blockquote: {
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      paddingLeft: 12,
      paddingVertical: 4,
      marginVertical: 8,
    },

    // Lists
    bullet_list: { marginVertical: 6 },
    bullet_list_icon: {
      marginLeft: 4,
      marginRight: 10,
      color: colors.text,
      fontSize: 16,
      lineHeight: 24,
      minWidth: 14,
      textAlign: "center" as const,
    },
    bullet_list_content: { flex: 1 },
    ordered_list: { marginVertical: 6 },
    ordered_list_icon: {
      marginRight: 8,
      color: colors.text,
      fontSize: 14,
      lineHeight: 24,
      minWidth: 20,
    },
    ordered_list_content: { flex: 1 },
    list_item: {
      flexDirection: "row" as const,
      marginVertical: 2,
    },

    // Table
    table: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginVertical: 12,
      borderRadius: 6,
      overflow: "hidden" as const,
    },
    thead: {
      backgroundColor: colors.surface,
    },
    tbody: {},
    th: {
      padding: 10,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontFamily: "NotoSansJP_600SemiBold",
      fontSize: 13,
    },
    td: {
      padding: 10,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
      fontSize: 13,
    },
    tr: {
      flexDirection: "row" as const,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },

    // Divider
    hr: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: 16,
    },
  };
}

// Bullet symbols per nesting level
const BULLET_CHARS = ["•", "◦", "▸"];

export const markdownRules = {
  fence: (node: any) => {
    const lang = node.sourceInfo?.trim() || undefined;
    return <CodeBlock key={node.key} code={node.content} language={lang} />;
  },

  code_block: (node: any) => {
    return <CodeBlock key={node.key} code={node.content} />;
  },

  list_item: (
    node: any,
    children: any,
    parent: any,
    styles: any,
    inheritedStyles: any = {}
  ) => {
    const isBullet =
      Array.isArray(parent) &&
      parent.some((p: any) => p.type === "bullet_list");

    if (isBullet) {
      const depth = Array.isArray(parent)
        ? parent.filter((p: any) => p.type === "bullet_list").length
        : 1;
      const bullet = BULLET_CHARS[(depth - 1) % BULLET_CHARS.length];
      return (
        <View key={node.key} style={styles._VIEW_SAFE_list_item}>
          <Text style={[inheritedStyles, styles._VIEW_SAFE_bullet_list_icon]}>
            {bullet}
          </Text>
          <View style={styles._VIEW_SAFE_bullet_list_content}>{children}</View>
        </View>
      );
    }

    return (
      <View key={node.key} style={styles._VIEW_SAFE_list_item}>
        <Text style={[inheritedStyles, styles._VIEW_SAFE_ordered_list_icon]}>
          {node.index + 1}
          {node.markup}
        </Text>
        <View style={styles._VIEW_SAFE_ordered_list_content}>{children}</View>
      </View>
    );
  },
};
