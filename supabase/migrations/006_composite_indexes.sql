-- Composite indexes for manifest queries:
--   SELECT id, ..., updated_at FROM notes WHERE user_id = $1
-- The composite (user_id, updated_at DESC) allows the planner to skip sorting.
create index if not exists idx_notes_user_updated on notes (user_id, updated_at desc);
create index if not exists idx_tasks_user_updated on tasks (user_id, updated_at desc);
