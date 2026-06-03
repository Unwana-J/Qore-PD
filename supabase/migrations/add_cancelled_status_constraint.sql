-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add 'Cancelled' to service_extensions status CHECK constraint
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing constraint
ALTER TABLE public.service_extensions 
  DROP CONSTRAINT IF EXISTS service_extensions_status_check;

-- Recreate constraint allowing 'Cancelled' alongside other statuses
ALTER TABLE public.service_extensions 
  ADD CONSTRAINT service_extensions_status_check 
  CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Suspended', 'Frozen', 'Cancelled'));
