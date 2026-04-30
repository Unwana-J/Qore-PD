-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: rename Frozen -> Suspended + add suspension_request column
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Update any existing 'Frozen' records to 'Suspended'
UPDATE service_extensions SET status = 'Suspended' WHERE status = 'Frozen';

-- 2. Drop and recreate the status CHECK constraint with 'Suspended'
ALTER TABLE service_extensions DROP CONSTRAINT IF EXISTS service_extensions_status_check;
ALTER TABLE service_extensions
  ADD CONSTRAINT service_extensions_status_check
  CHECK (status IN ('Not Started', 'In Progress', 'Completed', 'Suspended'));

-- 3. Add the suspension_request JSONB column for the approval workflow
ALTER TABLE service_extensions
  ADD COLUMN IF NOT EXISTS suspension_request JSONB DEFAULT NULL;
