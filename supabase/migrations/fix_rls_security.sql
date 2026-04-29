-- ══════════════════════════════════════════════════════════════
--  SECURITY FIX: Enable RLS on tables missing it
--  Run this in the Supabase SQL Editor.
--  It is fully additive — no data is modified.
-- ══════════════════════════════════════════════════════════════

-- 1. Projects table (the primary vulnerability flagged by Supabase)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read all projects
DROP POLICY IF EXISTS "Authenticated users can view projects" ON public.projects;
CREATE POLICY "Authenticated users can view projects"
ON public.projects FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert new projects
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
CREATE POLICY "Authenticated users can insert projects"
ON public.projects FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update projects
DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;
CREATE POLICY "Authenticated users can update projects"
ON public.projects FOR UPDATE
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete projects (e.g. bulk import cleanup)
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON public.projects;
CREATE POLICY "Authenticated users can delete projects"
ON public.projects FOR DELETE
USING (auth.role() = 'authenticated');


-- ──────────────────────────────────────────────────────────────
-- 2. Catch-all: Enable RLS on any other public tables that may
--    have been created outside the main setup script.
--    (Safe to run — has no effect on tables that already have it)
-- ──────────────────────────────────────────────────────────────

-- audit_logs (already enabled, but polices are being reinforced)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
