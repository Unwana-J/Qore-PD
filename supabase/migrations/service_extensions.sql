-- ══════════════════════════════════════════════════════════════════════════════
--  Service Extensions — Database Migration
--  Run in Supabase SQL Editor (Steps 1 & 2 separately if needed)
-- ══════════════════════════════════════════════════════════════════════════════

-- STEP 1: Add implementation_manager to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS implementation_manager TEXT;

-- STEP 2: Create service_extensions table
CREATE TABLE IF NOT EXISTS public.service_extensions (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name               TEXT NOT NULL,
  service_id                TEXT NOT NULL,
  service_name              TEXT NOT NULL,
  service_variant           TEXT NOT NULL,           -- sub-service display name
  sub_service_id            TEXT,                    -- ServiceSubService.id
  baseline_days             INTEGER NOT NULL DEFAULT 0, -- locked at creation
  implementation_manager    TEXT NOT NULL,
  start_date                DATE NOT NULL DEFAULT NOW()::DATE,
  target_closure_date       DATE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'Not Started'
                              CHECK (status IN ('Not Started','In Progress','Completed','Frozen')),
  milestones                JSONB NOT NULL DEFAULT '[]',
  -- Project mapping
  linked_project_id         UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  mapping_status            TEXT NOT NULL DEFAULT 'None'
                              CHECK (mapping_status IN ('None','Pending','Approved','Rejected','Unmapped')),
  mapping_requested_at      TIMESTAMPTZ,
  mapping_approved_at       TIMESTAMPTZ,
  mapping_rejection_comment TEXT,
  mapping_notes             TEXT,
  unmap_comment             TEXT,
  -- Metadata
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent two active extensions with the same client + service + variant
CREATE UNIQUE INDEX IF NOT EXISTS uix_service_extension_active
  ON public.service_extensions (client_name, service_id, service_variant)
  WHERE status != 'Completed';

-- Enable RLS
ALTER TABLE public.service_extensions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view service extensions" ON public.service_extensions;
CREATE POLICY "Authenticated users can view service extensions"
  ON public.service_extensions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can insert service extensions" ON public.service_extensions;
CREATE POLICY "Authenticated users can insert service extensions"
  ON public.service_extensions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update service extensions" ON public.service_extensions;
CREATE POLICY "Authenticated users can update service extensions"
  ON public.service_extensions FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete service extensions" ON public.service_extensions;
CREATE POLICY "Authenticated users can delete service extensions"
  ON public.service_extensions FOR DELETE
  USING (auth.role() = 'authenticated');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.touch_service_extension_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_service_extension_updated_at ON public.service_extensions;
CREATE TRIGGER set_service_extension_updated_at
  BEFORE UPDATE ON public.service_extensions
  FOR EACH ROW EXECUTE FUNCTION public.touch_service_extension_updated_at();
