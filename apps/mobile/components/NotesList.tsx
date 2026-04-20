import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Alert,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../src/theme";
import { useNoteStore } from "../src/store/noteStore";
import type { Note } from "@flote/types";

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  return `${diffDays}日前`;
}

function extractTitle(note: Note): string {
  if (note.title) return note.title;
  const firstLine = note.body_md.split("\n").find((l) => l.trim());
  if (!firstLine) return "無題のノート";
  return firstLine.replace(/^#{1,6}\s+/, "").trim() || "無題のノート";
}

type Props = {
  userId: string | null;
};

export default function NotesList({ userId }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const notes = useNoteStore((s) => s.notes);
  const loading = useNoteStore((s) => s.loading);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const [search, setSearch] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) fetchNotes(userId);
  }, [userId]);

  const filtered = useMemo(() => {
    if (!search) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        extractTitle(n).toLowerCase().includes(q) ||
        n.body_md.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const handleRefresh = useCallback(() => {
    if (userId) fetchNotes(userId);
  }, [userId]);

  const enterSelectMode = useCallback((id: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      "削除の確認",
      `${count}件のノートを削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            await Promise.all([...selectedIds].map((id) => deleteNote(id)));
            exitSelectMode();
          },
        },
      ]
    );
  }, [selectedIds, deleteNote, exitSelectMode]);

  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const title = extractTitle(item);
      const isSelected = selectedIds.has(item.id);

      if (selectMode) {
        return (
          <TouchableOpacity
            style={[
              styles.item,
              {
                backgroundColor: isSelected ? colors.accent + "22" : colors.surface,
                borderColor: isSelected ? colors.accent : colors.border,
              },
            ]}
            onPress={() => toggleSelect(item.id)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.checkbox,
              {
                borderColor: isSelected ? colors.accent : colors.textSecondary,
                backgroundColor: isSelected ? colors.accent : "transparent",
              },
            ]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.itemDate, { color: colors.textSecondary }]} numberOfLines={1}>
              {relativeDate(item.updated_at)}
            </Text>
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/(app)/notes/${item.id}` as never)}
          onLongPress={() => enterSelectMode(item.id)}
          delayLongPress={400}
          activeOpacity={0.7}
        >
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.itemDate, { color: colors.textSecondary }]} numberOfLines={1}>
            {relativeDate(item.updated_at)}
          </Text>
        </TouchableOpacity>
      );
    },
    [colors, selectMode, selectedIds, toggleSelect, enterSelectMode]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {selectMode ? (
        <View style={[styles.selectHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.selectCount, { color: colors.text }]}>
            {selectedIds.size}件選択中
          </Text>
          <TouchableOpacity onPress={exitSelectMode}>
            <Text style={[styles.cancelText, { color: colors.accent }]}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={[styles.searchInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="検索..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                ノートがありません
              </Text>
            </View>
          ) : null
        }
      />

      {selectMode && (
        <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.deleteButton,
              { backgroundColor: selectedIds.size > 0 ? "#ff3b30" : colors.border },
            ]}
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>
              削除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchInput: {
    height: 40,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  selectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectCount: {
    fontSize: 15,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 15,
  },
  list: { padding: 16, paddingBottom: 40 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  itemDate: { fontSize: 12, flexShrink: 0 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16 },
  actionBar: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
