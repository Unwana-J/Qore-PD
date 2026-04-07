-- Migration: Add delivery_track column to projects table
-- Run this in your Supabase SQL Editor
-- This is safe to run on existing data - it backfills automatically

-- Step 1: Add the column with a default of 'Standard' so existing rows get a value
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS delivery_track TEXT NOT NULL DEFAULT 'Standard';

-- Step 2: Backfill existing Internal Initiative projects
UPDATE projects
  SET delivery_track = 'Internal Initiative'
  WHERE is_internal_initiative = true;

-- Step 3: Verify the migration
SELECT 
  delivery_track,
  COUNT(*) AS project_count
FROM projects
GROUP BY delivery_track
ORDER BY delivery_track;
