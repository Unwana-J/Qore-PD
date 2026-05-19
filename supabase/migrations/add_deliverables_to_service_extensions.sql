-- Migration to add deliverables column to service_extensions table
ALTER TABLE service_extensions ADD COLUMN IF NOT EXISTS deliverables JSONB NOT NULL DEFAULT '[]';
