export { createClient, getClient } from "./client";
export * from "./notes";
export * from "./tasks";
export {
  getNotes as getLocalNotes,
  saveNote as saveLocalNote,
  deleteNote as deleteLocalNote,
  getTasks as getLocalTasks,
  saveTask as saveLocalTask,
  deleteTask as deleteLocalTask,
} from "./local-storage";
