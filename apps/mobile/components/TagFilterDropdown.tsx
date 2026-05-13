import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme";

type Props = {
  tags: string[];
  selectedTag: string | null;
  onSelect: (tag: string | null) => void;
};

export function TagFilterDropdown({ tags, selectedTag, onSelect }: Props) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  if (tags.length === 0) return null;

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="pricetag-outline" size={14} color={selectedTag ? colors.accent : colors.textSecondary} />
        <Text style={[styles.btnText, { color: selectedTag ? colors.accent : colors.textSecondary }]} numberOfLines={1}>
          {selectedTag ? `#${selectedTag}` : "タグで絞り込む"}
        </Text>
        <Ionicons name="chevron-down" size={14} color={selectedTag ? colors.accent : colors.textSecondary} />
      </TouchableOpacity>

      {selectedTag && (
        <TouchableOpacity
          style={[styles.clearBtn, { borderColor: colors.border }]}
          onPress={() => onSelect(null)}
          hitSlop={8}
        >
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: colors.surface, shadowColor: "#000" }]}>
            <Text style={[styles.menuHeader, { color: colors.textSecondary, borderBottomColor: colors.border }]}>
              タグで絞り込む
            </Text>
            <ScrollView bounces={false} style={{ maxHeight: 320 }}>
              <TouchableOpacity
                style={[styles.menuItem, !selectedTag && { backgroundColor: colors.accent + "18" }]}
                onPress={() => { onSelect(null); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.menuItemText, { color: !selectedTag ? colors.accent : colors.text }]}>
                  すべて表示
                </Text>
                {!selectedTag && <Ionicons name="checkmark" size={16} color={colors.accent} />}
              </TouchableOpacity>
              {tags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.menuItem, active && { backgroundColor: colors.accent + "18" }]}
                    onPress={() => { onSelect(tag); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.menuItemText, { color: active ? colors.accent : colors.text }]}>
                      #{tag}
                    </Text>
                    {active && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// Single-row tag chips for list items: show up to 2 tags + "+N" overflow
type TagsProps = {
  tags: string[];
  accentColor: string;
};

export function TagChips({ tags, accentColor }: TagsProps) {
  if (tags.length === 0) return null;
  const visible = tags.slice(0, 2);
  const overflow = tags.length - visible.length;
  return (
    <View style={chipStyles.row}>
      {visible.map((tag) => (
        <View key={tag} style={[chipStyles.chip, { backgroundColor: accentColor + "22", borderColor: accentColor + "55" }]}>
          <Text style={[chipStyles.text, { color: accentColor }]} numberOfLines={1}>#{tag}</Text>
        </View>
      ))}
      {overflow > 0 && (
        <View style={[chipStyles.chip, { backgroundColor: accentColor + "11", borderColor: accentColor + "33" }]}>
          <Text style={[chipStyles.text, { color: accentColor }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: { flex: 1, fontSize: 13 },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  menu: {
    borderRadius: 14,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  menuHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuItemText: { fontSize: 16 },
});

const chipStyles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "nowrap", gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, flexShrink: 1, maxWidth: 140 },
  text: { fontSize: 12, fontWeight: "500" },
});
