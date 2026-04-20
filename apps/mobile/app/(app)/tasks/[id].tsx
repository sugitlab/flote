import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Markdown from "react-native-markdown-display";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { useTaskStore } from "../../../src/store/taskStore";
import { supabase } from "../../../src/lib/supabase";
import type { Task } from "@flote/types";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const saveTask = useTaskStore((s) => s.saveTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskRef = useRef<Task | null>(null);

  const task = tasks.find((t) => t.id === id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch((e) => console.error("[taskDetail] getUser failed:", e));
  }, []);

  useEffect(() => {
    if (task) {
      taskRef.current = task;
      if (!editing) setContent(task.body_md);
    }
  }, [task?.id]);

  const debouncedSave = useCallback(
    (text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (!userId || !taskRef.current) return;
        const updated: Task = {
          ...taskRef.current,
          body_md: text,
          title: text.split("\n").find((l) => l.trim())?.replace(/^#{1,6}\s+/, "").trim() ?? "",
          updated_at: new Date().toISOString(),
        };
        taskRef.current = updated;
        saveTask(updated, userId);
      }, 500);
    },
    [userId, saveTask]
  );

  const handleChangeText = (text: string) => {
    setContent(text);
    debouncedSave(text);
  };

  const handleDelete = () => {
    Alert.alert("削除確認", "このタスクを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          if (id) {
            await deleteTask(id);
            router.back();
          }
        },
      },
    ]);
  };

  const handleToggleDone = () => {
    if (!userId || !taskRef.current) return;
    const updated: Task = {
      ...taskRef.current,
      done: !taskRef.current.done,
      updated_at: new Date().toISOString(),
    };
    taskRef.current = updated;
    saveTask(updated, userId);
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (!userId || !taskRef.current || !selectedDate) return;
    const updated: Task = {
      ...taskRef.current,
      due_date: selectedDate.toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    };
    taskRef.current = updated;
    saveTask(updated, userId);
  };

  const handleClearDate = () => {
    if (!userId || !taskRef.current) return;
    const updated: Task = {
      ...taskRef.current,
      due_date: null,
      updated_at: new Date().toISOString(),
    };
    taskRef.current = updated;
    saveTask(updated, userId);
  };

  const markdownStyles = {
    body: { color: colors.text, fontSize: 16, lineHeight: 24, overflow: "visible" as const },
    heading1: { color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: "bold" as const, marginTop: 0, marginBottom: 8, paddingTop: 0, overflow: "visible" as const },
    heading2: { color: colors.text, fontSize: 24, fontWeight: "bold" as const, marginVertical: 6 },
    heading3: { color: colors.text, fontSize: 20, fontWeight: "bold" as const, marginVertical: 4 },
    paragraph: { color: colors.text, marginVertical: 4 },
    link: { color: colors.accent },
    code_inline: {
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontSize: 14,
    },
    code_block: {
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
    },
    fence: {
      backgroundColor: colors.surface,
      color: colors.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 14,
    },
    blockquote: {
      borderLeftColor: colors.accent,
      borderLeftWidth: 3,
      paddingLeft: 12,
      marginVertical: 8,
    },
    list_item: { color: colors.text },
    bullet_list: { color: colors.text },
    ordered_list: { color: colors.text },
    hr: { backgroundColor: colors.border },
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => setEditing(!editing)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>
                  {editing ? "完了" : "編集"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Task meta info */}
        {task && (
          <View style={[styles.metaBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.metaChip}
              onPress={handleToggleDone}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: task.done ? colors.accent : colors.textSecondary,
                    backgroundColor: task.done ? colors.accent : "transparent",
                  },
                ]}
              >
                {task.done && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text
                style={[
                  styles.metaStatus,
                  { color: task.done ? colors.accent : "#ff9500" },
                ]}
              >
                {task.done ? "完了" : "未完了"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.metaChip, { marginLeft: "auto" }]}
              onPress={() => setShowDatePicker(true)}
              onLongPress={task.due_date ? handleClearDate : undefined}
              activeOpacity={0.6}
            >
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaDue, { color: colors.textSecondary }]}>
                {task.due_date ? `期日: ${task.due_date}` : "期日を設定"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showDatePicker && (
          <DateTimePicker
            value={task?.due_date ? new Date(task.due_date) : new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={handleDateChange}
          />
        )}

        {editing ? (
          <TextInput
            style={[
              styles.editor,
              {
                color: colors.text,
                backgroundColor: colors.background,
                fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
              },
            ]}
            value={content}
            onChangeText={handleChangeText}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholder="メモをMarkdownで入力..."
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
            <View style={{ height: 4 }} />
            {content ? (
              <Markdown style={markdownStyles}>{content}</Markdown>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                メモがありません。「編集」をタップして書き始めましょう。
              </Text>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  metaBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { color: "#fff", fontSize: 12, fontWeight: "bold", marginTop: -1 },
  metaStatus: { fontSize: 14, fontWeight: "600" },
  metaDue: { fontSize: 13 },
  editor: { flex: 1, padding: 16, fontSize: 15, lineHeight: 22 },
  preview: { flex: 1 },
  previewContent: { padding: 16, paddingTop: 20 },
});
