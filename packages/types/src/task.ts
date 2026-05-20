export type TaskStatus =
  | "Todo"
  | "InProgress"
  | "Waiting"
  | "Reviewing"
  | "NoPlan"
  | "HalfwaySpot"
  | "LastEffort"
  | "Done";

export type Task = {
  id: string;
  title: string;
  body_md: string;
  due_date: string | null;
  status: TaskStatus;
  pinned: boolean;
  updated_at: string;
};

export type TaskInsert = Omit<Task, "id" | "updated_at">;
export type TaskUpdate = Partial<Omit<Task, "id">>;
