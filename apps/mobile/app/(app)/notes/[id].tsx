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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Markdown from "react-native-markdown-display";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { makeMarkdownStyles, makeMarkdownRules } from "../../../src/markdownStyles";
import { useNoteStore } from "../../../src/store/noteStore";
import { useTaskStore } from "../../../src/store/taskStore";
import { supabase } from "../../../src/lib/supabase";
import { generateId } from "../../../src/utils";
import { useT } from "../../../src/hooks/useT";
import type { Note, Task } from "@flote/types";

export default function NoteDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const router = useRouter();
  const notes = useNoteStore((s) => s.notes);
  const saveNote = useNoteStore((s) => s.saveNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const ensureBodyMd = useNoteStore((s) => s.ensureBodyMd);
  const saveTask = useTaskStore((s) => s.saveTask);
  const [editing, setEditing] = useState(edit === "1");
  const [content, setContent] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = useRef<Note | null>(null);

  const note = notes.find((n) => n.id === id);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch((e) => console.error("[noteDetail] getUser failed:", e));
  }, []);

  useEffect(() => {
    if (id) ensureBodyMd(id);
  }, [id]);

  useEffect(() => {
    if (note) {
      noteRef.current = note;
      if (!editing) setContent(note.body_md);
    }
  }, [note?.id, note?.body_md]);

  const debouncedSave = useCallback(
    (text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (!userId || !noteRef.current) return;
        const updated: Note = {
          ...noteRef.current,
          body_md: text,
          title: text.split("\n").find((l) => l.trim())?.replace(/^#{1,6}\s+/, "").trim() ?? "",
          updated_at: new Date().toISOString(),
        };
        noteRef.current = updated;
        saveNote(updated, userId);
      }, 500);
    },
    [userId, saveNote]
  );

  const handleChangeText = (text: string) => {
    setContent(text);
    debouncedSave(text);
  };

  const handleConvertToTask = () => {
    Alert.alert(t.notes.convertToTaskTitle, t.notes.convertToTaskMessage, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.notes.convert,
        onPress: async () => {
          if (!userId || !noteRef.current) return;
          const note = noteRef.current;
          const newTask: Task = {
            id: generateId(),
            title: note.title || content.split("\n").find((l) => l.trim())?.replace(/^#{1,6}\s+/, "").trim() || t.tasks.untitled,
            body_md: note.body_md,
            due_date: null,
            status: "Todo",
            pinned: false,
            updated_at: new Date().toISOString(),
          };
          await saveTask(newTask, userId);
          await deleteNote(note.id);
          router.replace(`/(app)/tasks/${newTask.id}` as never);
        },
      },
    ]);
  };

  const handleTogglePin = () => {
    if (!userId || !noteRef.current) return;
    const updated: Note = { ...noteRef.current, pinned: !noteRef.current.pinned, updated_at: new Date().toISOString() };
    noteRef.current = updated;
    saveNote(updated, userId);
  };

  const handleDelete = () => {
    Alert.alert(t.notes.deleteConfirmTitle, t.notes.deleteConfirmMessage, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          if (id) {
            await deleteNote(id);
            router.back();
          }
        },
      },
    ]);
  };

  const markdownStyles = makeMarkdownStyles(colors);
  const markdownRules = makeMarkdownRules(colors);

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
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <TouchableOpacity onPress={handleConvertToTask} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 22, lineHeight: 26 }}>↻</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleTogglePin} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={note?.pinned ? "pin" : "pin-outline"} size={22} color={note?.pinned ? colors.accent : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(!editing)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>{editing ? t.common.done : t.common.edit}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
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
            placeholder={t.notes.editorPlaceholder}
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
            <View style={{ height: 4 }} />
            {content ? (
              <Markdown style={markdownStyles} rules={markdownRules}>{content}</Markdown>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                {t.notes.emptyBody}
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
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editor: { flex: 1, padding: 16, fontSize: 15, lineHeight: 22 },
  preview: { flex: 1 },
  previewContent: { padding: 16, paddingTop: 20 },
});
