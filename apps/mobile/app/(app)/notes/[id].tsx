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
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Markdown from "react-native-markdown-display";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { makeMarkdownStyles, markdownRules } from "../../../src/markdownStyles";
import { useNoteStore } from "../../../src/store/noteStore";
import { useTaskStore } from "../../../src/store/taskStore";
import { supabase } from "../../../src/lib/supabase";
import { generateId } from "../../../src/utils";
import type { Note, Task } from "@flote/types";

export default function NoteDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const notes = useNoteStore((s) => s.notes);
  const saveNote = useNoteStore((s) => s.saveNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
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
    if (note) {
      noteRef.current = note;
      if (!editing) setContent(note.body_md);
    }
  }, [note?.id]);

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
    Alert.alert("タスクに変換", "このノートをタスクに変換しますか？元のノートは削除されます。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "変換",
        onPress: async () => {
          if (!userId || !noteRef.current) return;
          const note = noteRef.current;
          const newTask: Task = {
            id: generateId(),
            title: note.title || content.split("\n").find((l) => l.trim())?.replace(/^#{1,6}\s+/, "").trim() || "新しいタスク",
            body_md: note.body_md,
            due_date: null,
            done: false,
            updated_at: new Date().toISOString(),
          };
          await saveTask(newTask, userId);
          await deleteNote(note.id);
          router.replace(`/(app)/tasks/${newTask.id}` as never);
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert("削除確認", "このノートを削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
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

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <TouchableOpacity onPress={handleConvertToTask} style={{ marginRight: 4 }}>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 20, lineHeight: 24 }}>↻</Text>
                </View>
              </TouchableOpacity>
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
            placeholder="ここにMarkdownを入力..."
            placeholderTextColor={colors.textSecondary}
          />
        ) : (
          <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
            <View style={{ height: 4 }} />
            {content ? (
              <Markdown style={markdownStyles} rules={markdownRules}>{content}</Markdown>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                ノートが空です。編集ボタンをタップして書き始めましょう。
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
  editor: { flex: 1, padding: 16, fontSize: 15, lineHeight: 22 },
  preview: { flex: 1 },
  previewContent: { padding: 16, paddingTop: 20 },
});
