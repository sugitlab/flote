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
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { useNoteStore } from "../../../src/store/noteStore";
import { supabase } from "../../../src/lib/supabase";
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

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function extractTitle(note: Note): string {
  if (note.title) return note.title;
  const firstLine = note.body_md.split("\n").find((l) => l.trim());
  if (!firstLine) return "無題のノート";
  return firstLine.replace(/^#{1,6}\s+/, "").trim() || "無題のノート";
}

export default function NotesListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const notes = useNoteStore((s) => s.notes);
  const loading = useNoteStore((s) => s.loading);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const saveNote = useNoteStore((s) => s.saveNote);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchNotes(data.user.id);
      }
    }).catch((e) => console.error("[notes] getUser failed:", e));
  }, []);

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

  const handleCreate = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    const newNote: Note = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: "",
      body_md: "",
      updated_at: now,
    };
    try {
      await saveNote(newNote, userId);
      router.push(`/(app)/notes/${newNote.id}` as never);
    } catch (e) {
      Alert.alert("エラー", "ノートの作成に失敗しました");
    }
  }, [userId]);

  const renderItem = useCallback(
    ({ item }: { item: Note }) => {
      const title = extractTitle(item);
      const preview = stripMarkdown(item.body_md).slice(0, 100);
      return (
        <TouchableOpacity
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/(app)/notes/${item.id}` as never)}
          activeOpacity={0.7}
        >
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemDate, { color: colors.textSecondary }]}>
              {relativeDate(item.updated_at)}
            </Text>
          </View>
          {preview ? (
            <Text style={[styles.itemPreview, { color: colors.textSecondary }]} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </TouchableOpacity>
      );
    },
    [colors]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>ノート</Text>
      </View>

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

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent, bottom: insets.bottom + 70 }]}
        onPress={handleCreate}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold" },
  searchInput: {
    height: 40,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  list: { padding: 16, paddingBottom: 100 },
  item: {
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  itemTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  itemMeta: { flexDirection: "row", marginBottom: 4 },
  itemDate: { fontSize: 12 },
  itemPreview: { fontSize: 13, lineHeight: 18 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16 },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
