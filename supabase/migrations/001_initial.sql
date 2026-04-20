-- notes
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null default '',
  body_md text not null default '',
  updated_at timestamptz not null default now()
);
alter table notes enable row level security;
create policy "users can crud own notes"
  on notes for all using (auth.uid() = user_id);

-- tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  due_date date,
  remind_at timestamptz,
  done boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table tasks enable row level security;
create policy "users can crud own tasks"
  on tasks for all using (auth.uid() = user_id);
