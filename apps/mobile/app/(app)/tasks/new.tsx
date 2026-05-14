import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../src/theme";
import { useTaskStore } from "../../../src/store/taskStore";
import { supabase } from "../../../src/lib/supabase";
import { useT } from "../../../src/hooks/useT";
import type { Task } from "@flote/types";

function generateUUID(): string {
  const hex = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      id += "-";
    } else if (i === 14) {
      id += "4";
    } else if (i === 19) {
      id += hex[(Math.random() * 4) | 8];
    } else {
      id += hex[(Math.random() * 16) | 0];
    }
  }
  return id;
}

export default function NewTaskScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const t = useT();
  const saveTask = useTaskStore((s) => s.saveTask);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch((e) => console.error("[taskNew] getUser failed:", e));
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !userId || loading) return;
    setLoading(true);
    const now = new Date().toISOString();
    const task: Task = {
      id: generateUUID(),
      title: title.trim(),
      body_md: `# ${title.trim()}`,
      due_date: dueDate ? dueDate.toISOString().split("T")[0] : null,
      done: false,
      updated_at: now,
    };
    try {
      await saveTask(task, userId);
      router.back();
    } catch {
      Alert.alert(t.auth.error, t.tasks.createFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(Platform.OS === "ios");
    if (date) setDueDate(date);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: t.tasks.newTaskTitle,
          presentation: "modal",
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>{t.common.cancel}</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleCreate} disabled={!title.trim() || loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text
                  style={{
                    color: title.trim() ? colors.accent : colors.textSecondary,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {t.tasks.add}
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder={t.tasks.namePlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.dateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.dateText, { color: dueDate ? colors.text : colors.textSecondary }]}>
            {dueDate ? dueDate.toISOString().split("T")[0] : t.tasks.setDueDateOptional}
          </Text>
          {dueDate && (
            <TouchableOpacity onPress={() => setDueDate(null)}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={dueDate ?? new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
          />
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    gap: 10,
  },
  dateText: { flex: 1, fontSize: 16 },
});
