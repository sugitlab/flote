-- Enable Realtime for notes and tasks
alter publication supabase_realtime add table notes;
alter publication supabase_realtime add table tasks;

-- REPLICA IDENTITY FULL so DELETE payloads include all columns (not just id)
alter table notes replica identity full;
alter table tasks replica identity full;
