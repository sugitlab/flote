import type { Task } from "@flote/types";
import type { TaskRepository } from "../types";
import {
  getTasks as getLocalTasks,
  saveTask as saveLocalTask,
  deleteTask as deleteLocalTask,
} from "../../local-storage";

export class LocalTaskRepository implements TaskRepository {
  async getTasks(): Promise<Task[]> {
    return getLocalTasks();
  }

  async saveTask(task: Task): Promise<Task> {
    await saveLocalTask(task);
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await deleteLocalTask(id);
  }

  async toggleDone(id: string, done: boolean): Promise<void> {
    const tasks = await getLocalTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated: Task = {
      ...task,
      done,
      updated_at: new Date().toISOString(),
    };
    await saveLocalTask(updated);
  }
}
