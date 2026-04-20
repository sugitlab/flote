-- Add body_md column to tasks table for task notes/memo
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS body_md text DEFAULT '';
