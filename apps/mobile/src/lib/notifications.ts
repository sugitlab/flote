import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Task } from "@flote/types";

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "タスクリマインダー",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function scheduleTaskReminder(task: Task, reminderHour: number): Promise<void> {
  await cancelTaskReminder(task.id);
  if (!task.due_date) return;

  const [year, month, day] = task.due_date.split("-").map(Number);
  const remindAt = new Date(year, month - 1, day, reminderHour, 0, 0);
  if (remindAt <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `task-${task.id}`,
    content: {
      title: "⏰ リマインダー",
      body: task.title || "タスクのリマインダー",
      data: { taskId: task.id },
      ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
    },
    trigger: remindAt,
  });
}

export async function cancelTaskReminder(taskId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`);
  } catch {
    // Not scheduled — ignore
  }
}

export async function rescheduleAllReminders(tasks: Task[], reminderHour: number): Promise<void> {
  await Promise.all(tasks.map((t) => scheduleTaskReminder(t, reminderHour)));
}
