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
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../src/theme";
import { useNoteStore } from "../src/store/noteStore";
import { useSettingsStore } from "../src/store/settingsStore";
import { extractTags, allTags } from "../src/tagUtils";
import { TagFilterIcon, SortIcon, TagChips } from "./TagFilterDropdown";
import type { Note } from "@flote/types";

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
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

function bodySnippet(body: string, query: string, radius = 40): string {
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + body.slice(start, end).replace(/\n/g, " ") + (end < body.length ? "…" : "");
}

type Props = { userId: string | null };

export default function NotesList({ userId }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const notes = useNoteStore((s) => s.notes);
  const loading = useNoteStore((s) => s.loading);
  const fetchNotes = useNoteStore((s) => s.fetchNotes);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const searchFullText = useSettingsStore((s) => s.searchFullText);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"updated" | "title">("updated");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (userId) fetchNotes(userId); }, [userId]);

  const tags = useMemo(() => allTags(notes), [notes]);

  const filtered = useMemo(() => {
    let result = notes;
    if (selectedTag) result = result.filter((n) => extractTags((n.title ?? "") + " " + n.body_md).includes(selectedTag));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((n) => {
        if (extractTitle(n).toLowerCase().includes(q)) return true;
        if (searchFullText && n.body_md.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    const arr = [...result];
    if (sortOrder === "title") {
      arr.sort((a, b) => extractTitle(a).localeCompare(extractTitle(b), "ja"));
    } else {
      arr.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return arr;
  }, [notes, search, searchFullText, selectedTag, sortOrder]);

  const handleRefresh = useCallback(() => { if (userId) fetchNotes(userId); }, [userId]);

  const enterSelectMode = useCallback((id: string) => { setSelectMode(true); setSelectedIds(new Set([id])); }, []);
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); }, []);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    Alert.alert("削除の確認", `${selectedIds.size}件のノートを削除しますか？`, [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: async () => {
        await Promise.all([...selectedIds].map((id) => deleteNote(id)));
        exitSelectMode();
      }},
    ]);
  }, [selectedIds, deleteNote, exitSelectMode]);

  const renderItem = useCallback(({ item }: { item: Note }) => {
    const title = extractTitle(item);
    const isSelected = selectedIds.has(item.id);
    const itemTags = extractTags((item.title ?? "") + " " + item.body_md);

    if (selectMode) {
      return (
        <TouchableOpacity
          style={[styles.item, styles.itemRow, {
            backgroundColor: isSelected ? colors.accent + "22" : colors.surface,
            borderColor: isSelected ? colors.accent : colors.border,
          }]}
          onPress={() => toggleSelect(item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, {
            borderColor: isSelected ? colors.accent : colors.textSecondary,
            backgroundColor: isSelected ? colors.accent : "transparent",
          }]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.itemDate, { color: colors.textSecondary }]}>{relativeDate(item.updated_at)}</Text>
        </TouchableOpacity>
      );
    }

    const q = search.trim();
    const titleMatches = q ? extractTitle(item).toLowerCase().includes(q.toLowerCase()) : false;
    const snippet = searchFullText && q && !titleMatches ? bodySnippet(item.body_md, q) : "";

    return (
      <TouchableOpacity
        style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/(app)/notes/${item.id}` as never)}
        onLongPress={() => enterSelectMode(item.id)}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        <View style={styles.itemRow}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.itemDate, { color: colors.textSecondary }]}>{relativeDate(item.updated_at)}</Text>
        </View>
        {snippet ? <Text style={[styles.itemSnippet, { color: colors.textSecondary }]} numberOfLines={2}>{snippet}</Text> : null}
        <TagChips tags={itemTags} accentColor={colors.accent} />
      </TouchableOpacity>
    );
  }, [colors, selectMode, selectedIds, search, searchFullText, toggleSelect, enterSelectMode]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {selectMode ? (
        <View style={[styles.selectHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.selectCount, { color: colors.text }]}>{selectedIds.size}件選択中</Text>
          <TouchableOpacity onPress={exitSelectMode}>
            <Text style={[styles.cancelText, { color: colors.accent }]}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.searchRow}>
          <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="検索..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <View style={[styles.clearBtn, { backgroundColor: colors.textSecondary }]}>
                  <Text style={styles.clearBtnText}>✕</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          <TagFilterIcon tags={tags} selectedTag={selectedTag} onSelect={setSelectedTag} />
          <SortIcon
            options={[
              { key: "updated", label: "更新日時" },
              { key: "title",   label: "タイトル" },
            ]}
            value={sortOrder}
            onChange={(v) => setSortOrder(v as "updated" | "title")}
          />
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {selectedTag ? `#${selectedTag} のノートはありません` : "ノートがありません"}
            </Text>
          </View>
        ) : null}
      />

      {selectMode && (
        <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: selectedIds.size > 0 ? "#ff3b30" : colors.border }]}
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>削除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 8, gap: 8 },
  searchWrap: { flex: 1, flexDirection: "row", alignItems: "center", height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  clearBtn: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  clearBtnText: { color: "#fff", fontSize: 10, fontWeight: "bold", lineHeight: 12 },
  selectHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  selectCount: { fontSize: 15, fontWeight: "600" },
  cancelText: { fontSize: 15 },
  list: { padding: 16, paddingBottom: 40 },
  item: { flexDirection: "column", padding: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  itemRow: { flexDirection: "row", alignItems: "center" },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  itemDate: { fontSize: 12, flexShrink: 0 },
  itemSnippet: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16 },
  actionBar: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  deleteButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
