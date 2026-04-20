import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
import { useTaskStore } from "../../src/store/taskStore";
import { supabase } from "../../src/lib/supabase";

export default function AppLayout() {
  const { colors } = useTheme();
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        fetchTasks(data.user.id);
      }
    }).catch((e) => console.error("[appLayout] getUser failed:", e));
  }, []);

  const overdueCount = tasks.filter((t) => {
    if (t.done || !t.due_date) return false;
    return new Date(t.due_date) < new Date(new Date().toDateString());
  }).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="notes"
        options={{
          title: "ノート",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "タスク",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkbox-outline" size={size} color={color} />
          ),
          tabBarBadge: overdueCount > 0 ? overdueCount : undefined,
          tabBarBadgeStyle: overdueCount > 0 ? { backgroundColor: colors.danger } : undefined,
        }}
      />
    </Tabs>
  );
}
