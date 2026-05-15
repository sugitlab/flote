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
import { makeMarkdownStyles, makeMarkdownRules } from "../../../src/markdownStyles";
import { scheduleTaskReminder, cancelTaskReminder } from "../../../src/lib/notifications";
import { useSettingsStore } from "../../../src/store/settingsStore";
import { useTaskStore } from "../../../src/store/taskStore";
import { useNoteStore } from "../../../src/store/noteStore";
import { supabase } from "../../../src/lib/supabase";
import { generateId } from "../../../src/utils";
import { useT } from "../../../src/hooks/useT";
import type { Task, Note } from "@flote/types";

export default function TaskDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const saveTask = useTaskStore((s) => s.saveTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const saveNote = useNoteStore((s) => s.saveNote);
  const reminderHour = useSettingsStore((s) => s.reminderHour);
  const [editing, setEditing] = useState(edit === "1");
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
          title: text.split("\n").find((l) => l.trim())?.replace(/^#{1,6}\s+/, "").trim() ?? t.tasks.untitled,
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

  const handleConvertToNote = () => {
    Alert.alert(t.tasks.convertToNoteTitle, t.tasks.convertToNoteMessage, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.tasks.convert,
        onPress: async () => {
          if (!userId || !taskRef.current) return;
          const task = taskRef.current;
          const newNote: Note = {
            id: generateId(),
            title: task.title,
            body_md: task.body_md,
            updated_at: new Date().toISOString(),
          };
          await saveNote(newNote, userId);
          await deleteTask(task.id);
          router.replace(`/(app)/notes/${newNote.id}` as never);
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(t.tasks.deleteConfirmTitle, t.tasks.deleteConfirmMessage, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          if (id) {
            cancelTaskReminder(id);
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
    const due_date = selectedDate.toISOString().split("T")[0];
    const updated: Task = {
      ...taskRef.current,
      due_date,
      updated_at: new Date().toISOString(),
    };
    taskRef.current = updated;
    saveTask(updated, userId);
    scheduleTaskReminder(updated, reminderHour);
  };

  const handleClearDate = () => {
    if (!userId || !taskRef.current) return;
    cancelTaskReminder(taskRef.current.id);
    const updated: Task = {
      ...taskRef.current,
      due_date: null,
      updated_at: new Date().toISOString(),
    };
    taskRef.current = updated;
    saveTask(updated, userId);
  };

  const markdownStyles = makeMarkdownStyles(colors);
  const markdownRules = makeMarkdownRules(colors);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 8 }}
            >
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <TouchableOpacity onPress={handleConvertToNote} style={{ marginRight: 4 }}>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 20, lineHeight: 24 }}>↻</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(!editing)}>
                <Text style={{ color: colors.accent, fontSize: 16 }}>
                  {editing ? t.common.done : t.common.edit}
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
                {task.done ? t.tasks.markDone : t.tasks.markNotDone}
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
                {task.due_date ? `${t.tasks.dueLabel} ${task.due_date}` : t.tasks.setDueDate}
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
            placeholder={t.tasks.editorPlaceholder}
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
            <View style={{ height: 4 }} />
            {content ? (
              <Markdown style={markdownStyles} rules={markdownRules}>{content}</Markdown>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                {t.tasks.emptyBody}
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
