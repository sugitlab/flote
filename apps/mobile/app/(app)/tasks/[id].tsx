import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  type TextInput as TextInputType,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Markdown from "react-native-markdown-display";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { makeMarkdownStyles, makeMarkdownRules } from "../../../src/markdownStyles";
import { scheduleTaskReminder, cancelTaskReminder } from "../../../src/lib/notifications";
import { useSettingsStore } from "../../../src/store/settingsStore";
import { useTaskStore } from "../../../src/store/taskStore";
import { useNoteStore } from "../../../src/store/noteStore";
import { supabase } from "../../../src/lib/supabase";
import { generateId } from "../../../src/utils";
import { useT } from "../../../src/hooks/useT";
import { useMarkdownInput } from "../../../src/hooks/useMarkdownInput";
import MarkdownToolbar from "../../../components/MarkdownToolbar";
import type { Task, Note, TaskStatus } from "@flote/types";

const STATUS_COLORS: Record<TaskStatus, string> = {
  Todo: "#6b7280",
  InProgress: "#3b82f6",
  Waiting: "#f59e0b",
  Reviewing: "#8b5cf6",
  NoPlan: "#9ca3af",
  HalfwaySpot: "#06b6d4",
  LastEffort: "#ef4444",
  Done: "#22c55e",
};

export default function TaskDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const saveTask = useTaskStore((s) => s.saveTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const ensureBodyMd = useTaskStore((s) => s.ensureBodyMd);
  const saveNote = useNoteStore((s) => s.saveNote);
  const reminderHour = useSettingsStore((s) => s.reminderHour);
  const [editing, setEditing] = useState(edit === "1");
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskRef = useRef<Task | null>(null);

  const task = tasks.find((t) => t.id === id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch((e) => console.error("[taskDetail] getUser failed:", e));
  }, []);

  useEffect(() => {
    if (id) ensureBodyMd(id);
  }, [id]);

  useEffect(() => {
    if (task) {
      taskRef.current = task;
      if (!editing) setContent(task.body_md);
    }
  }, [task?.id, task?.body_md]);

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
    setMenuVisible(false);
    setTimeout(() => {
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
            pinned: false,
            note_type: "markdown",
            updated_at: new Date().toISOString(),
          };
          await saveNote(newNote, userId);
          await deleteTask(task.id);
          router.replace(`/(app)/notes/${newNote.id}` as never);
        },
      },
    ]);
    }, 300);
  };

  const handleTogglePin = () => {
    if (!userId || !taskRef.current) return;
    const updated: Task = { ...taskRef.current, pinned: !taskRef.current.pinned, updated_at: new Date().toISOString() };
    taskRef.current = updated;
    saveTask(updated, userId);
    setMenuVisible(false);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setTimeout(() => {
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
    }, 300);
  };

  const STATUS_ORDER: TaskStatus[] = ["Todo", "InProgress", "Waiting", "Reviewing", "NoPlan", "HalfwaySpot", "LastEffort", "Done"];

  const handleStatusPicker = () => {
    if (!userId || !taskRef.current) return;
    setStatusPickerVisible(true);
  };

  const handleSelectStatus = (s: TaskStatus) => {
    if (!userId || !taskRef.current) return;
    const updated: Task = { ...taskRef.current, status: s, updated_at: new Date().toISOString() };
    taskRef.current = updated;
    saveTask(updated, userId);
    setStatusPickerVisible(false);
  };

  const handleOpenDatePicker = () => {
    const initial = taskRef.current?.due_date ? new Date(taskRef.current.due_date + "T12:00:00") : new Date();
    setTempDate(initial);
    setShowDatePicker(true);
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
      if (_event.type === "dismissed" || !selectedDate || !userId || !taskRef.current) return;
      const due_date = selectedDate.toISOString().split("T")[0];
      const updated: Task = { ...taskRef.current, due_date, updated_at: new Date().toISOString() };
      taskRef.current = updated;
      saveTask(updated, userId);
      scheduleTaskReminder(updated, reminderHour);
    } else {
      if (selectedDate) setTempDate(selectedDate);
    }
  };

  const handleDateConfirm = () => {
    setShowDatePicker(false);
    if (!userId || !taskRef.current) return;
    const due_date = tempDate.toISOString().split("T")[0];
    const updated: Task = { ...taskRef.current, due_date, updated_at: new Date().toISOString() };
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

  const inputRef = useRef<TextInputType>(null);
  const { handleChangeText: mdHandleChangeText, handleSelectionChange, insertAtCursor, insertLinePrefix } =
    useMarkdownInput(content, handleChangeText, inputRef);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Custom header */}
        <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => setEditing(!editing)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerIconBtn}
            >
              <Ionicons
                name={editing ? "checkmark" : "create-outline"}
                size={22}
                color={editing ? colors.accent : colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        {task && (
          <View style={[styles.metaBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.metaChip}
              onPress={handleStatusPicker}
              activeOpacity={0.6}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: STATUS_COLORS[task.status] },
                ]}
              />
              <Text
                style={[
                  styles.metaStatus,
                  { color: STATUS_COLORS[task.status] },
                ]}
              >
                {t.tasks.statuses?.[task.status] ?? task.status}
              </Text>
              <Text style={[styles.statusChevron, { color: colors.textSecondary }]}>▾</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.metaChip, { marginLeft: "auto" }]}
              onPress={handleOpenDatePicker}
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

        {Platform.OS === "android" && showDatePicker && (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {editing ? (
          <View style={{ flex: 1 }}>
            <TextInput
              ref={inputRef}
              style={[
                styles.editor,
                {
                  color: colors.text,
                  backgroundColor: colors.background,
                  fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
                },
              ]}
              value={content}
              onChangeText={mdHandleChangeText}
              onSelectionChange={handleSelectionChange}
              multiline
              autoFocus
              textAlignVertical="top"
              placeholder={t.tasks.editorPlaceholder}
              placeholderTextColor={colors.textSecondary}
            />
            <MarkdownToolbar onInsertWrap={insertAtCursor} onInsertLinePrefix={insertLinePrefix} />
          </View>
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

      {Platform.OS === "ios" && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
            <Pressable style={[styles.dateModalSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <View style={[styles.dateModalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: colors.accent, fontSize: 16 }}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDateConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "600" }}>{t.common.done}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                style={{ backgroundColor: colors.surface }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* 3-dot menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={[styles.menuSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            {/* Pin */}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleTogglePin}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={task?.pinned ? "pin" : "pin-outline"}
                size={20}
                color={task?.pinned ? colors.accent : colors.text}
              />
              <Text style={[styles.menuItemText, { color: task?.pinned ? colors.accent : colors.text }]}>
                {task?.pinned ? t.tasks.unpin ?? "ピン留めを解除" : t.tasks.pin ?? "ピン留め"}
              </Text>
              {task?.pinned && <Ionicons name="checkmark" size={16} color={colors.accent} />}
            </TouchableOpacity>

            {/* Convert to note */}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleConvertToNote}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {t.tasks.convertToNoteTitle}
              </Text>
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>
                {t.common.delete}
              </Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity
              style={[styles.cancelItem, { borderTopColor: colors.border }]}
              onPress={() => setMenuVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={statusPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStatusPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStatusPickerVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.textSecondary }]}>{t.tasks.markDone}</Text>
            {STATUS_ORDER.map((s) => {
              const isCurrent = task?.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectStatus(s)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusOptionDot, { backgroundColor: STATUS_COLORS[s] }]} />
                  <Text style={[styles.statusOptionText, { color: colors.text }]}>
                    {t.tasks.statuses?.[s] ?? s}
                  </Text>
                  {isCurrent && <Text style={[styles.statusCheck, { color: STATUS_COLORS[s] }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.cancelOption, { borderTopColor: colors.border }]}
              onPress={() => setStatusPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelOptionText, { color: colors.textSecondary }]}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusChevron: { fontSize: 11 },
  metaStatus: { fontSize: 14, fontWeight: "600" },
  metaDue: { fontSize: 13 },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  editor: { flex: 1, padding: 16, fontSize: 15, lineHeight: 22 },
  preview: { flex: 1 },
  previewContent: { padding: 16, paddingTop: 20 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  menuSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: { flex: 1, fontSize: 16 },
  cancelItem: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth * 4,
  },
  cancelText: { fontSize: 16 },
  modalSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16 },
  modalTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center", paddingVertical: 14 },
  statusOption: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  statusOptionDot: { width: 12, height: 12, borderRadius: 6 },
  statusOptionText: { flex: 1, fontSize: 16 },
  statusCheck: { fontSize: 16, fontWeight: "700" },
  cancelOption: { marginTop: 8, paddingVertical: 16, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth * 4 },
  cancelOptionText: { fontSize: 16 },
  dateModalSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16 },
  dateModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
