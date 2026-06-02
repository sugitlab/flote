-- Add note_type column to notes table
-- Run this in the Supabase SQL editor

alter table notes add column if not exists note_type text default 'markdown';
