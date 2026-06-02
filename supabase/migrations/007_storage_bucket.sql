-- Storage bucket for Excalidraw embedded image files.
-- Keeps large base64 blobs out of the notes.body_md column, dramatically
-- reducing DB IO on every sync. Files are stored at {user_id}/{note_id}.json.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-files', 'note-files', false, 104857600, '{"application/json"}')
on conflict (id) do nothing;

-- RLS: each user can only access their own files (first path segment = user_id)
create policy "note_files_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note_files_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note_files_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "note_files_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
