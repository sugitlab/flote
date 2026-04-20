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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
import { useNoteStore } from "../../src/store/noteStore";
import { supabase } from "../../src/lib/supabase";
import NotesList from "../../components/NotesList";
import TasksList from "../../components/TasksList";
import type { Note } from "@flote/types";

function generateId(): string {
  // Generate UUID v4 compatible with PostgreSQL uuid type
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

const TABS = ["ノート", "タスク"] as const;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const saveNote = useNoteStore((s) => s.saveNote);

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
        router.push(`/(app)/notes/${newNote.id}` as never);
      } catch {
        Alert.alert("エラー", "ノートの作成に失敗しました");
      }
    } else {
      router.push("/(app)/tasks/new" as never);
    }
  }, [userId, activeTab]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {TABS[activeTab]}
        </Text>
        <TouchableOpacity
          onPress={handleAdd}
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab indicator */}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
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
