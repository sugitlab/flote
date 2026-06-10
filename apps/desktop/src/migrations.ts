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
end $$;

-- Composite indexes for manifest queries (delta sync)
create index if not exists idx_notes_user_updated on notes (user_id, updated_at desc);
create index if not exists idx_tasks_user_updated on tasks (user_id, updated_at desc);

-- Redundant indexes from older versions (write-IO amplification)
drop index if exists idx_notes_user_id;
drop index if exists idx_tasks_user_id;
drop index if exists idx_tasks_due_date;

-- Storage bucket for Excalidraw files and SVG previews
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-files', 'note-files', false, 104857600, '{"application/json","image/svg+xml"}')
on conflict (id) do update set allowed_mime_types = '{"application/json","image/svg+xml"}';

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'note_files_select') then
    create policy note_files_select on storage.objects for select to authenticated
      using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'note_files_insert') then
    create policy note_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'note_files_update') then
    create policy note_files_update on storage.objects for update to authenticated
      using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'note_files_delete') then
    create policy note_files_delete on storage.objects for delete to authenticated
      using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- Tombstones for delta sync
create table if not exists deletions (
  user_id uuid not null references auth.users on delete cascade,
  id uuid not null,
  kind text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table deletions enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'deletions' and policyname = 'deletions_select'
  ) then
    create policy deletions_select on deletions for select using (auth.uid() = user_id);
  end if;
end $$;

grant select on public.deletions to authenticated;
grant all on public.deletions to service_role;

create index if not exists idx_deletions_user_deleted on deletions (user_id, deleted_at desc);

create or replace function record_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into deletions (user_id, id, kind, deleted_at)
  values (old.user_id, old.id, tg_table_name, now())
  on conflict (user_id, id) do update set deleted_at = now(), kind = excluded.kind;
  return old;
end $$;

drop trigger if exists notes_record_deletion on notes;
create trigger notes_record_deletion
  after delete on notes for each row execute function record_deletion();

drop trigger if exists tasks_record_deletion on tasks;
create trigger tasks_record_deletion
  after delete on tasks for each row execute function record_deletion();

-- Slim realtime broadcasts (replaces full-row postgres_changes streaming)
create or replace function notify_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  begin
    perform realtime.send(
      jsonb_build_object('kind', tg_table_name, 'event', tg_op, 'id', rec.id, 'updated_at', rec.updated_at),
      'change',
      'sync:' || rec.user_id::text,
      true
    );
  exception when others then null;
  end;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists notes_notify_sync on notes;
create trigger notes_notify_sync
  after insert or update or delete on notes for each row execute function notify_sync();

drop trigger if exists tasks_notify_sync on tasks;
create trigger tasks_notify_sync
  after insert or update or delete on tasks for each row execute function notify_sync();

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'sync_broadcast_select'
  ) then
    create policy sync_broadcast_select on realtime.messages
      for select to authenticated
      using (realtime.topic() = 'sync:' || auth.uid()::text);
  end if;
exception when others then null;
end $$;

do $$ begin
  alter publication supabase_realtime drop table notes;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime drop table tasks;
exception when others then null;
end $$;

-- Data API grants
grant all on public.notes to authenticated;
grant all on public.notes to service_role;
grant all on public.tasks to authenticated;
grant all on public.tasks to service_role;
grant all on public.transactions to authenticated;
grant all on public.transactions to service_role;`;

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
  // Tombstone table required for delta sync (009)
  const { error: delError } = await supabase
    .from("deletions")
    .select("id")
    .limit(0);
  if (delError) {
    return "not_initialized";
  }
  return "ok";
}
