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
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import Markdown from "react-native-markdown-display";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { makeMarkdownStyles, makeMarkdownRules } from "../../../src/markdownStyles";
import { useNoteStore } from "../../../src/store/noteStore";
import { useTaskStore } from "../../../src/store/taskStore";
import { supabase } from "../../../src/lib/supabase";
import { generateId } from "../../../src/utils";
import { useT } from "../../../src/hooks/useT";
import { useMarkdownInput } from "../../../src/hooks/useMarkdownInput";
import MarkdownToolbar from "../../../components/MarkdownToolbar";
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
  const [menuVisible, setMenuVisible] = useState(false);
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

  const handleTogglePin = () => {
    if (!userId || !noteRef.current) return;
    const updated: Note = { ...noteRef.current, pinned: !noteRef.current.pinned, updated_at: new Date().toISOString() };
    noteRef.current = updated;
    saveNote(updated, userId);
    setMenuVisible(false);
  };

  const handleConvertToTask = () => {
    setMenuVisible(false);
    setTimeout(() => {
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
    }, 300);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setTimeout(() => {
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
    }, 300);
  };

  const isExcalidraw = note?.note_type === "excalidraw";

  const excalidrawSvgHtml = (() => {
    if (!isExcalidraw || !note) return "";
    try {
      const body = JSON.parse(note.body_md);
      const svg: string = body.svg ?? "";
      if (!svg) return "";
      return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:${colors.background};display:flex;align-items:center;justify-content:center;min-height:100vh;}svg{max-width:100%;height:auto;}</style></head><body>${svg}</body></html>`;
    } catch { return ""; }
  })();

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
            {!isExcalidraw && (
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
            )}
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {isExcalidraw ? (
          excalidrawSvgHtml ? (
            <WebView
              source={{ html: excalidrawSvgHtml }}
              style={{ flex: 1, backgroundColor: colors.background }}
              scrollEnabled
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                図はデスクトップ版で作成・編集してください
              </Text>
            </View>
          )
        ) : editing ? (
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
              placeholder={t.notes.editorPlaceholder}
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
                {t.notes.emptyBody}
              </Text>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

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
                name={note?.pinned ? "pin" : "pin-outline"}
                size={20}
                color={note?.pinned ? colors.accent : colors.text}
              />
              <Text style={[styles.menuItemText, { color: note?.pinned ? colors.accent : colors.text }]}>
                {note?.pinned ? t.notes.unpin ?? "ピン留めを解除" : t.notes.pin ?? "ピン留め"}
              </Text>
              {note?.pinned && <Ionicons name="checkmark" size={16} color={colors.accent} />}
            </TouchableOpacity>

            {/* Convert to task */}
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleConvertToTask}
              activeOpacity={0.7}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {t.notes.convertToTaskTitle}
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
});
