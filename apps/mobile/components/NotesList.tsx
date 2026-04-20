import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
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
  const [search, setSearch] = useState("");

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

  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const title = extractTitle(item);
      return (
        <TouchableOpacity
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/(app)/notes/${item.id}` as never)}
          activeOpacity={0.7}
        >
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
            {relativeDate(item.updated_at)}
          </Text>
        </TouchableOpacity>
      );
    },
    [colors]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TextInput
        style={[styles.searchInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        placeholder="検索..."
        placeholderTextColor={colors.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

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
  list: { padding: 16, paddingBottom: 40 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  itemDate: { fontSize: 12 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16 },
});
