import type { Task } from "@flote/types";
import type { TaskRepository } from "../types";
import { getTasks, getTaskById, saveTask, deleteTask } from "../../sqlite-storage";

export class LocalTaskRepository implements TaskRepository {
  async getTasks(_userId: string): Promise<Task[]> {
    return getTasks();
  }

  async getTaskById(id: string): Promise<Task | null> {
    return getTaskById(id);
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

  async toggleDone(id: string, done: boolean): Promise<void> {
    const task = await getTaskById(id);
    if (!task) return;
    await saveTask({ ...task, done, updated_at: new Date().toISOString() });
  }
}
