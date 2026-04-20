-- Add created_at columns
alter table notes add column if not exists created_at timestamptz not null default now();
alter table tasks add column if not exists created_at timestamptz not null default now();

-- Add indexes on user_id for query performance
create index if not exists idx_notes_user_id on notes(user_id);
create index if not exists idx_tasks_user_id on tasks(user_id);

-- Add index on tasks due_date for section grouping queries
create index if not exists idx_tasks_due_date on tasks(due_date) where done = false;

-- Replace single "for all" RLS policies with granular per-operation policies
-- Notes
drop policy if exists "users can crud own notes" on notes;
create policy "notes_select" on notes for select using (auth.uid() = user_id);
create policy "notes_insert" on notes for insert with check (auth.uid() = user_id);
create policy "notes_update" on notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete" on notes for delete using (auth.uid() = user_id);

-- Tasks
drop policy if exists "users can crud own tasks" on tasks;
create policy "tasks_select" on tasks for select using (auth.uid() = user_id);
create policy "tasks_insert" on tasks for insert with check (auth.uid() = user_id);
create policy "tasks_update" on tasks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks_delete" on tasks for delete using (auth.uid() = user_id);

-- Add check constraint: task title must not be empty
alter table tasks add constraint tasks_title_not_empty check (length(trim(title)) > 0);
