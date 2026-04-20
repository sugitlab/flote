import { useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  RefreshControl,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme";
import { useTaskStore } from "../src/store/taskStore";
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

type Props = {
  userId: string | null;
};

export default function TasksList({ userId }: Props) {
  const { colors } = useTheme();
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const toggleDone = useTaskStore((s) => s.toggleDone);

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
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
});
