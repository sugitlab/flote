import type { SupabaseClient } from "@supabase/supabase-js";

export const SCHEMA_SQL = `-- Flote データベースセットアップ
-- Supabase の SQL エディタで実行してください

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '',
  body_md text not null default '',
  pinned boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Migration for existing installations
alter table notes add column if not exists pinned boolean default false;
alter table notes add column if not exists note_type text default 'markdown';

alter table notes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'notes' and policyname = 'notes_owner'
  ) then
    create policy notes_owner on notes for all using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '',
  body_md text not null default '',
  due_date date,
  done boolean not null default false,
  status text not null default 'Todo',
  updated_at timestamptz not null default now()
);

-- Migration for existing installations
alter table tasks add column if not exists status text default 'Todo';
update tasks set status = 'Done' where done = true and (status is null or status = 'Todo');
alter table tasks add column if not exists pinned boolean default false;

alter table tasks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'tasks' and policyname = 'tasks_owner'
  ) then
    create policy tasks_owner on tasks for all using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  amount integer not null,
  type text not null check (type in ('income', 'expense')),
  description text not null default '',
  category text not null default '',
  account text not null default '',
  updated_at timestamptz not null default now()
);

alter table transactions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'transactions' and policyname = 'transactions_owner'
  ) then
    create policy transactions_owner on transactions for all using (auth.uid() = user_id);
  end if;
end $$;`;

export type SchemaStatus = "ok" | "not_initialized";

export async function checkSchema(supabase: SupabaseClient): Promise<SchemaStatus> {
  const { error } = await supabase.from("notes").select("id").limit(0);
  if (error) {
    const code = error.code ?? "";
    const msg = (error.message ?? "").toLowerCase();
    // 42P01: PostgreSQL undefined_table
    // PGRST200: PostgREST schema cache miss (table not found via REST API)
    if (
      code === "42P01" ||
      code === "PGRST200" ||
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      msg.includes("schema cache")
    ) {
      return "not_initialized";
    }
  }
  // Also check that required columns added by migrations exist
  const { error: colError } = await supabase
    .from("notes")
    .select("note_type, pinned")
    .limit(0);
  if (colError) {
    return "not_initialized";
  }
  return "ok";
}
