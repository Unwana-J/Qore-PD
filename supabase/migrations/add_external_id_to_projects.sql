-- Migration: Add external_id column to projects table for Zoho / Data Warehouse integration
-- Run this in your Supabase SQL Editor if it has not been applied yet.
-- The column enables idempotent upserts: if the data warehouse sends the same
-- project more than once (e.g. on an update event), the edge function can
-- use onConflict: 'external_id' to update in place rather than duplicate.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;

-- Index for fast lookups during upsert operations from the webhook
CREATE INDEX IF NOT EXISTS idx_projects_external_id
  ON public.projects(external_id);

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'external_id';
