import type { SupabaseClient } from "@supabase/supabase-js";

export const SCHEMA_SQL = `-- Flote データベースセットアップ
-- Supabase の SQL エディタで実行してください

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '',
  body_md text not null default '',
  updated_at timestamptz not null default now()
);

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
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'tasks' and policyname = 'tasks_owner'
  ) then
    create policy tasks_owner on tasks for all using (auth.uid() = user_id);
  end if;
end $$;`;

export type SchemaStatus = "ok" | "not_initialized";

export async function checkSchema(supabase: SupabaseClient): Promise<SchemaStatus> {
  const { error } = await supabase.from("notes").select("id").limit(0);
  if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
    return "not_initialized";
  }
  return "ok";
}
