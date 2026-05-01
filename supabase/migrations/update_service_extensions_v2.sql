-- Add missing workflow columns to service_extensions table
ALTER TABLE public.service_extensions
  ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS extension_request JSONB,
  ADD COLUMN IF NOT EXISTS extension_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS assignment_history JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS suspension_request JSONB;

-- Relax target_closure_date constraint for API-only services
ALTER TABLE public.service_extensions 
  ALTER COLUMN target_closure_date DROP NOT NULL;

-- Update status constraint to include 'Suspended' (sometimes referred to as 'Frozen' in legacy code)
ALTER TABLE public.service_extensions 
  DROP CONSTRAINT IF EXISTS service_extensions_status_check;

ALTER TABLE public.service_extensions 
  ADD CONSTRAINT service_extensions_status_check 
  CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Suspended', 'Frozen'));
