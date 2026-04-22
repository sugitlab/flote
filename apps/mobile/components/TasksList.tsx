import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../src/theme";
import { useTaskStore } from "../src/store/taskStore";
import type { Task } from "@flote/types";

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Section = { title: string; data: Task[] };

function groupTasks(tasks: Task[]): Section[] {
  const today = todayStr();
  const overdue: Task[] = [];
  const todayTasks: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.done) {
      done.push(t);
    } else if (t.due_date && t.due_date < today) {
      overdue.push(t);
    } else if (t.due_date === today) {
      todayTasks.push(t);
    } else {
      upcoming.push(t);
    }
  }

  const sections: Section[] = [];
  if (overdue.length) sections.push({ title: "期限切れ", data: overdue });
  if (todayTasks.length) sections.push({ title: "今日", data: todayTasks });
  if (upcoming.length) sections.push({ title: "今後", data: upcoming });
  if (done.length) sections.push({ title: "完了済み", data: done });
  return sections;
}

type Props = {
  userId: string | null;
};

export default function TasksList({ userId }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const toggleDone = useTaskStore((s) => s.toggleDone);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) fetchTasks(userId);
  }, [userId]);

  const sections = useMemo(() => groupTasks(tasks), [tasks]);

  const handleRefresh = useCallback(() => {
    if (userId) fetchTasks(userId);
  }, [userId]);

  const handleToggle = useCallback(
    (id: string) => {
      if (userId) toggleDone(id, userId);
    },
    [userId]
  );

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
      `${count}件のタスクを削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            await Promise.all([...selectedIds].map((id) => deleteTask(id)));
            exitSelectMode();
          },
        },
      ]
    );
  }, [selectedIds, deleteTask, exitSelectMode]);

  const isOverdue = (task: Task) =>
    !task.done && task.due_date != null && task.due_date < todayStr();

  const renderItem = useCallback(
    ({ item }: { item: Task }) => {
      const overdue = isOverdue(item);
      const isSelected = selectedIds.has(item.id);

      if (selectMode) {
        return (
          <TouchableOpacity
            style={[
              styles.row,
              {
                backgroundColor: isSelected ? colors.accent + "22" : colors.surface,
                borderColor: isSelected ? colors.accent : colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: 10,
                marginBottom: 6,
                paddingHorizontal: 14,
                paddingVertical: 14,
              },
            ]}
            onPress={() => toggleSelect(item.id)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.selectCircle,
              {
                borderColor: isSelected ? colors.accent : colors.textSecondary,
                backgroundColor: isSelected ? colors.accent : "transparent",
              },
            ]}>
              {isSelected && <Text style={styles.checkmarkText}>✓</Text>}
            </View>
            <Text
              style={[
                styles.itemTitle,
                { color: item.done ? colors.textSecondary : colors.text },
                item.done && styles.doneTitle,
              ]}
              numberOfLines={1}
            >
              {item.title || "無題のタスク"}
            </Text>
            <Text
              style={[
                styles.itemDate,
                { color: overdue ? colors.danger : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {item.due_date ?? ""}
            </Text>
          </TouchableOpacity>
        );
      }

      return (
        <View style={styles.row}>
          <Pressable
            onPress={() => handleToggle(item.id)}
            style={[
              styles.checkbox,
              {
                borderColor: item.done ? colors.accent : colors.textSecondary,
                backgroundColor: item.done ? colors.accent : "transparent",
              },
            ]}
            hitSlop={8}
          >
            {item.done && (
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>✓</Text>
            )}
          </Pressable>
          <TouchableOpacity
            style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push(`/(app)/tasks/${item.id}` as never)}
            onLongPress={() => enterSelectMode(item.id)}
            delayLongPress={400}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.itemTitle,
                { color: item.done ? colors.textSecondary : colors.text },
                item.done && styles.doneTitle,
              ]}
              numberOfLines={1}
            >
              {item.title || "無題のタスク"}
            </Text>
            <Text
              style={[
                styles.itemDate,
                { color: overdue ? colors.danger : colors.textSecondary },
              ]}
              numberOfLines={1}
            >
              {item.due_date ?? ""}
            </Text>
          </TouchableOpacity>
        </View>
      );
    },
    [colors, selectMode, selectedIds, toggleSelect, enterSelectMode, handleToggle]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <Text
        style={[
          styles.sectionTitle,
          {
            color: section.title === "期限切れ" ? colors.danger : colors.textSecondary,
            backgroundColor: colors.background,
          },
        ]}
      >
        {section.title}
      </Text>
    ),
    [colors]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {selectMode && (
        <View style={[styles.selectHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.selectCount, { color: colors.text }]}>
            {selectedIds.size}件選択中
          </Text>
          <TouchableOpacity onPress={exitSelectMode}>
            <Text style={[styles.cancelText, { color: colors.accent }]}>キャンセル</Text>
          </TouchableOpacity>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                タスクがありません
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  checkmarkText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemTitle: { fontSize: 16, fontWeight: "600", flex: 1, marginRight: 8 },
  doneTitle: { textDecorationLine: "line-through" },
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
