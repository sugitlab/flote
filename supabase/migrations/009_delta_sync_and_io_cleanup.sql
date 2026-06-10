-- Delta sync (tombstones), slim realtime broadcasts, and Disk IO cleanup.
-- Safe to run multiple times (idempotent).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tombstones: record deletions so clients can sync incrementally
--    (fetch only manifest rows with updated_at >= last sync + deleted ids)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists deletions (
  user_id uuid not null references auth.users on delete cascade,
  id uuid not null,
  kind text not null, -- 'notes' | 'tasks' (tg_table_name)
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

-- Trigger: write a tombstone whenever a note/task row is deleted.
-- security definer so RLS on deletions never blocks the insert.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Slim realtime broadcasts: replace postgres_changes (which streams every
--    column, including megabyte-scale body_md, to every client) with a tiny
--    {kind, event, id, updated_at} broadcast sent from a trigger.
--    realtime.send failures are swallowed so writes never break, even on
--    self-hosted stacks without the function.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function notify_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  begin
    perform realtime.send(
      jsonb_build_object(
        'kind', tg_table_name,
        'event', tg_op,
        'id', rec.id,
        'updated_at', rec.updated_at
      ),
      'change',
      'sync:' || rec.user_id::text,
      true
    );
  exception when others then
    null; -- realtime.send unavailable — clients still sync on startup/manual
  end;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists notes_notify_sync on notes;
create trigger notes_notify_sync
  after insert or update or delete on notes for each row execute function notify_sync();

drop trigger if exists tasks_notify_sync on tasks;
create trigger tasks_notify_sync
  after insert or update or delete on tasks for each row execute function notify_sync();

-- Allow each user to subscribe to their own private sync channel
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'realtime' and tablename = 'messages' and policyname = 'sync_broadcast_select'
  ) then
    create policy sync_broadcast_select on realtime.messages
      for select to authenticated
      using (realtime.topic() = 'sync:' || auth.uid()::text);
  end if;
exception when others then
  null; -- realtime.messages not available on this stack
end $$;

-- Stop streaming full rows over WAL — broadcasts above replace postgres_changes
do $$ begin
  alter publication supabase_realtime drop table notes;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime drop table tasks;
exception when others then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index cleanup: redundant indexes amplify write IO on every upsert
--    - idx_*_user_id duplicate the leading column of idx_*_user_updated
--    - idx_tasks_due_date is never used (filtering happens client-side)
-- ─────────────────────────────────────────────────────────────────────────────
drop index if exists idx_notes_user_id;
drop index if exists idx_tasks_user_id;
drop index if exists idx_tasks_due_date;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Allow SVG previews in the note-files bucket (moved out of body_md)
-- ─────────────────────────────────────────────────────────────────────────────
update storage.buckets
  set allowed_mime_types = '{"application/json","image/svg+xml"}'
  where id = 'note-files';
