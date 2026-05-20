import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../src/theme";
import { useTaskStore } from "../src/store/taskStore";
import { useSettingsStore } from "../src/store/settingsStore";
import { extractTags, allTags } from "../src/tagUtils";
import { TagFilterIcon, SortIcon, TagChips } from "./TagFilterDropdown";
import { useT } from "../src/hooks/useT";
import { relativeDate } from "../src/utils/date";
import type { Task } from "@flote/types";

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Section = { title: string; data: Task[] };

function groupTasks(tasks: Task[], groups: { overdue: string; today: string; upcoming: string; done: string }): Section[] {
  const today = todayStr();
  const overdue: Task[] = [], todayTasks: Task[] = [], upcoming: Task[] = [], done: Task[] = [];
  for (const t of tasks) {
    if (t.status === "Done") done.push(t);
    else if (t.due_date && t.due_date < today) overdue.push(t);
    else if (t.due_date === today) todayTasks.push(t);
    else upcoming.push(t);
  }
  const sections: Section[] = [];
  if (overdue.length) sections.push({ title: groups.overdue, data: overdue });
  if (todayTasks.length) sections.push({ title: groups.today, data: todayTasks });
  if (upcoming.length) sections.push({ title: groups.upcoming, data: upcoming });
  if (done.length) sections.push({ title: groups.done, data: done });
  return sections;
}

function bodySnippet(body: string, query: string, radius = 40): string {
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + body.slice(start, end).replace(/\n/g, " ") + (end < body.length ? "…" : "");
}

type Props = { userId: string | null };

export default function TasksList({ userId }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const t = useT();
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const updateStatus = useTaskStore((s) => s.updateStatus);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks);
  const searchFullText = useSettingsStore((s) => s.searchFullText);

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"updated" | "due">("due");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (userId) fetchTasks(userId); }, [userId]);

  const tags = useMemo(() => allTags(tasks), [tasks]);

  const filtered = useMemo(() => {
    let result = hideCompletedTasks ? tasks.filter((t) => t.status !== "Done") : tasks;
    if (selectedTag) result = result.filter((task) => extractTags((task.title ?? "") + " " + task.body_md).includes(selectedTag));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((task) => {
        if ((task.title ?? "").toLowerCase().includes(q)) return true;
        if (searchFullText && task.body_md.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    const arr = [...result];
    if (sortOrder === "due") {
      arr.sort((a, b) => {
        const aDone = a.status === "Done", bDone = b.status === "Done";
        if (aDone !== bDone) return aDone ? 1 : -1;
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    } else {
      arr.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    }
    return arr;
  }, [tasks, hideCompletedTasks, selectedTag, search, searchFullText, sortOrder]);

  const sections = useMemo(() => groupTasks(filtered, t.tasks.groups), [filtered, t]);

  const handleRefresh = useCallback(() => { if (userId) fetchTasks(userId); }, [userId]);
  const handleToggle = useCallback((id: string) => {
    const task = useTaskStore.getState().tasks.find((t) => t.id === id);
    if (!userId || !task) return;
    updateStatus(id, task.status === "Done" ? "Todo" : "Done", userId);
  }, [userId, updateStatus]);
  const enterSelectMode = useCallback((id: string) => { setSelectMode(true); setSelectedIds(new Set([id])); }, []);
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); }, []);
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    Alert.alert(t.tasks.deleteTitle, t.tasks.deleteMessage(selectedIds.size), [
      { text: t.common.cancel, style: "cancel" },
      { text: t.common.delete, style: "destructive", onPress: async () => {
        await Promise.all([...selectedIds].map((id) => deleteTask(id)));
        exitSelectMode();
      }},
    ]);
  }, [selectedIds, deleteTask, exitSelectMode, t]);

  const renderItem = useCallback(({ item }: { item: Task }) => {
    const overdue = item.status !== "Done" && item.due_date != null && item.due_date < todayStr();
    const isSelected = selectedIds.has(item.id);
    const itemTags = extractTags((item.title ?? "") + " " + item.body_md);
    const q = search.trim();
    const titleMatches = q ? (item.title ?? "").toLowerCase().includes(q.toLowerCase()) : false;
    const snippet = searchFullText && q && !titleMatches ? bodySnippet(item.body_md, q) : "";

    if (selectMode) {
      return (
        <TouchableOpacity
          style={[styles.row, {
            backgroundColor: isSelected ? colors.accent + "22" : colors.surface,
            borderColor: isSelected ? colors.accent : colors.border,
            borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 14,
          }]}
          onPress={() => toggleSelect(item.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.selectCircle, {
            borderColor: isSelected ? colors.accent : colors.textSecondary,
            backgroundColor: isSelected ? colors.accent : "transparent",
          }]}>
            {isSelected && <Text style={styles.checkmarkText}>✓</Text>}
          </View>
          <Text style={[styles.itemTitle, { color: item.status === "Done" ? colors.textSecondary : colors.text }, item.status === "Done" && styles.doneTitle]} numberOfLines={1}>
            {item.title || t.tasks.untitled}
          </Text>
          <Text style={[styles.itemDate, { color: overdue ? colors.danger : colors.textSecondary }]}>{item.due_date ? relativeDate(item.due_date, t.date) : ""}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.row}>
        <Pressable
          onPress={() => handleToggle(item.id)}
          style={[styles.checkbox, {
            borderColor: item.status === "Done" ? colors.accent : colors.textSecondary,
            backgroundColor: item.status === "Done" ? colors.accent : "transparent",
          }]}
          hitSlop={8}
        >
          {item.status === "Done" && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>✓</Text>}
        </Pressable>
        <TouchableOpacity
          style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push(`/(app)/tasks/${item.id}` as never)}
          onLongPress={() => enterSelectMode(item.id)}
          delayLongPress={400}
          activeOpacity={0.7}
        >
          <View style={styles.itemHeader}>
            <Text style={[styles.itemTitle, { color: item.status === "Done" ? colors.textSecondary : colors.text }, item.status === "Done" && styles.doneTitle]} numberOfLines={1}>
              {item.title || t.tasks.untitled}
            </Text>
            <Text style={[styles.itemDate, { color: overdue ? colors.danger : colors.textSecondary }]}>{item.due_date ? relativeDate(item.due_date, t.date) : ""}</Text>
          </View>
          {snippet ? <Text style={[styles.itemSnippet, { color: colors.textSecondary }]} numberOfLines={2}>{snippet}</Text> : null}
          <TagChips tags={itemTags} accentColor={colors.accent} />
        </TouchableOpacity>
      </View>
    );
  }, [colors, selectMode, selectedIds, search, searchFullText, toggleSelect, enterSelectMode, handleToggle, t]);

  const renderSectionHeader = useCallback(({ section }: { section: Section }) => (
    <Text style={[styles.sectionTitle, {
      color: section.title === t.tasks.groups.overdue ? colors.danger : colors.textSecondary,
      backgroundColor: colors.background,
    }]}>
      {section.title}
    </Text>
  ), [colors, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {selectMode ? (
        <View style={[styles.selectHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.selectCount, { color: colors.text }]}>{t.tasks.selectedCount(selectedIds.size)}</Text>
          <TouchableOpacity onPress={exitSelectMode}>
            <Text style={[styles.cancelText, { color: colors.accent }]}>{t.common.cancel}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.searchRow}>
          <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t.common.search}
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
              { key: "updated", label: t.tasks.sortByUpdated },
              { key: "due",     label: t.tasks.sortByDue },
            ]}
            value={sortOrder}
            onChange={(v) => setSortOrder(v as "updated" | "due")}
          />
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {selectedTag ? t.tasks.emptyFiltered(selectedTag) : t.tasks.empty}
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
            <Text style={styles.deleteButtonText}>{t.common.delete}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}</Text>
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
  sectionTitle: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: 10, marginTop: 14 },
  selectCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 },
  checkmarkText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  item: { flex: 1, padding: 14, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  itemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  doneTitle: { textDecorationLine: "line-through" },
  itemDate: { fontSize: 12, flexShrink: 0 },
  itemSnippet: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 16 },
  actionBar: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  deleteButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  deleteButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
