-- Migration: Add external_id to projects table for Zoho integration

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- Add an index for faster lookups during upsert operations
CREATE INDEX IF NOT EXISTS idx_projects_external_id ON public.projects(external_id);
