import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { useTaskStore } from "../../../src/store/taskStore";
import { supabase } from "../../../src/lib/supabase";
import type { Task } from "@flote/types";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
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

export default function TasksListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const toggleDone = useTaskStore((s) => s.toggleDone);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchTasks(data.user.id);
      }
    }).catch((e) => console.error("[tasks] getUser failed:", e));
  }, []);

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

  const isOverdue = (task: Task) =>
    !task.done && task.due_date != null && task.due_date < todayStr();

  const renderItem = useCallback(
    ({ item }: { item: Task }) => {
      const overdue = isOverdue(item);
      return (
        <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            onPress={() => handleToggle(item.id)}
            style={styles.checkbox}
            hitSlop={8}
          >
            <Ionicons
              name={item.done ? "checkbox" : "square-outline"}
              size={24}
              color={item.done ? colors.accent : colors.textSecondary}
            />
          </Pressable>
          <View style={styles.itemContent}>
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
            {item.due_date ? (
              <Text
                style={[
                  styles.itemDate,
                  { color: overdue ? colors.danger : colors.textSecondary },
                ]}
              >
                {item.due_date}
              </Text>
            ) : null}
          </View>
        </View>
      );
    },
    [colors, handleToggle]
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
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>タスク</Text>
      </View>

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

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent, bottom: insets.bottom + 70 }]}
        onPress={() => router.push("/(app)/tasks/new" as never)}
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
  list: { padding: 16, paddingBottom: 100 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingVertical: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  checkbox: { marginRight: 12 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 16 },
  doneTitle: { textDecorationLine: "line-through" },
  itemDate: { fontSize: 12, marginTop: 2 },
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
