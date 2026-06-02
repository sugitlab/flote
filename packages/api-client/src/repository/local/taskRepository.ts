import type { Task } from "@flote/types";
import type { TaskRepository, TaskManifest } from "../types";
import { getTasks, getTaskById, saveTask, deleteTask } from "../../sqlite-storage";

export class LocalTaskRepository implements TaskRepository {
  async getTasks(_userId: string): Promise<Task[]> {
    return getTasks();
  }

  async getTaskById(id: string): Promise<Task | null> {
    return getTaskById(id);
  }

  async getManifest(_userId: string): Promise<TaskManifest[]> {
    const tasks = await getTasks();
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      status: t.status,
      pinned: t.pinned,
      updated_at: t.updated_at,
    }));
  }

  async getTasksByIds(ids: string[]): Promise<Task[]> {
    const results: Task[] = [];
    for (const id of ids) {
      const task = await getTaskById(id);
      if (task) results.push(task);
    }
    return results;
  }

  async saveTask(task: Task, _userId: string): Promise<Task> {
    await saveTask(task);
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await deleteTask(id);
  }

  async deleteTasksBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      await deleteTask(id);
    }
  }
}
