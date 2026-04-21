export type Task = {
  id: string;
  title: string;
  body_md: string;
  due_date: string | null;
  done: boolean;
  updated_at: string;
};

export type TaskInsert = Omit<Task, "id" | "updated_at">;
export type TaskUpdate = Partial<Omit<Task, "id">>;
