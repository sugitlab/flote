import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useTheme } from "../../src/theme";
import { useNoteStore } from "../../src/store/noteStore";
import { useTaskStore } from "../../src/store/taskStore";
import { supabase } from "../../src/lib/supabase";
import NotesList from "../../components/NotesList";
import TasksList from "../../components/TasksList";
import SettingsPage from "../../components/SettingsPage";
import type { Note, Task } from "@flote/types";

function generateId(): string {
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

const TABS = ["ノート", "タスク", "設定"] as const;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const saveNote = useNoteStore((s) => s.saveNote);
  const saveTask = useTaskStore((s) => s.saveTask);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch((e) => console.error("[home] getUser failed:", e));
  }, []);

  const handleTabPress = useCallback((index: number) => {
    setActiveTab(index);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (page !== activeTab) setActiveTab(page);
  }, [activeTab]);

  const handleAdd = useCallback(async () => {
    if (!userId) return;

    if (activeTab === 0) {
      const now = new Date().toISOString();
      const newNote: Note = {
        id: generateId(),
        title: "",
        body_md: "",
        updated_at: now,
      };
      try {
        await saveNote(newNote, userId);
        router.push(`/(app)/notes/${newNote.id}?edit=1` as never);
      } catch {
        Alert.alert("エラー", "ノートの作成に失敗しました");
      }
    } else {
      const now = new Date().toISOString();
      const newTask: Task = {
        id: generateId(),
        title: "新しいタスク",
        body_md: "",
        due_date: null,
        done: false,
        updated_at: now,
      };
      try {
        await saveTask(newTask, userId);
        router.push(`/(app)/tasks/${newTask.id}?edit=1` as never);
      } catch {
        Alert.alert("エラー", "タスクの作成に失敗しました");
      }
    }
  }, [userId, activeTab, saveNote, saveTask]);

  const handleSignOut = useCallback(() => {
    // Auth state change will trigger redirect via _layout.tsx
  }, []);

  const showAddButton = activeTab < 2;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: TABS[activeTab],
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: showAddButton
            ? () => (
                <TouchableOpacity
                  onPress={handleAdd}
                  activeOpacity={0.5}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ color: colors.accent, fontSize: 30, lineHeight: 34, fontWeight: "300" }}>+</Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {TABS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[
                styles.tab,
                activeTab === i && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
              ]}
              onPress={() => handleTabPress(i)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === i ? colors.accent : colors.textSecondary,
                    fontWeight: activeTab === i ? "600" : "400",
                  },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Swipeable pages */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          <View style={{ width: SCREEN_WIDTH }}>
            <NotesList userId={userId} />
          </View>
          <View style={{ width: SCREEN_WIDTH }}>
            <TasksList userId={userId} />
          </View>
          <View style={{ width: SCREEN_WIDTH }}>
            <SettingsPage onSignOut={handleSignOut} />
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 4,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
  },
  pager: { flex: 1 },
});
