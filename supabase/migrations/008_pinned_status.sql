-- Add pinned column to notes and tasks (was missing from initial schema)
alter table notes add column if not exists pinned boolean not null default false;
alter table tasks add column if not exists pinned boolean not null default false;

-- Add multi-value status column to tasks (replaces done boolean)
alter table tasks add column if not exists status text not null default 'Todo';

-- Backfill: tasks previously marked done should get status = 'Done'
update tasks set status = 'Done' where done = true and status = 'Todo';

-- Grant access for data API (required for new columns after Supabase 2024-10 policy change)
grant all on public.notes to authenticated;
grant all on public.notes to service_role;
grant all on public.tasks to authenticated;
grant all on public.tasks to service_role;
