-- ══════════════════════════════════════════════════════════════════════════════
--  IM Workflows — Reassignment & Extensions
-- ══════════════════════════════════════════════════════════════════════════════

-- Add extension_request column to track pending date changes
ALTER TABLE public.service_extensions
  ADD COLUMN IF NOT EXISTS extension_request JSONB DEFAULT NULL;

-- Add extension_history to track past approvals
ALTER TABLE public.service_extensions
  ADD COLUMN IF NOT EXISTS extension_history JSONB DEFAULT '[]';

-- Add assignment_history to track IM changes
ALTER TABLE public.service_extensions
  ADD COLUMN IF NOT EXISTS assignment_history JSONB DEFAULT '[]';

COMMENT ON COLUMN public.service_extensions.extension_request IS 'Stores {newTargetDate, reason, requestedAt, requestedBy, status}';
COMMENT ON COLUMN public.service_extensions.extension_history IS 'Stores array of approved extensions';
COMMENT ON COLUMN public.service_extensions.assignment_history IS 'Stores array of {from, to, reassignedBy, timestamp}';

