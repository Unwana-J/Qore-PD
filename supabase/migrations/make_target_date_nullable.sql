-- ══════════════════════════════════════════════════════════════════════════════
--  Migration: Make target_closure_date nullable
--  Allows API implementations to be saved without a fixed deadline.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.service_extensions 
  ALTER COLUMN target_closure_date DROP NOT NULL;
