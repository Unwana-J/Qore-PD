-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add implementation_managers array column to projects table
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add the new implementation_managers text[] column
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS implementation_managers TEXT[] DEFAULT '{}';

-- 2. Backfill: for any project that already has a single implementation_manager,
--    seed the array from service_extensions approved mappings
UPDATE projects p
SET implementation_managers = sub.ims
FROM (
  SELECT
    linked_project_id AS project_id,
    ARRAY_AGG(DISTINCT implementation_manager) FILTER (WHERE implementation_manager IS NOT NULL) AS ims
  FROM service_extensions
  WHERE mapping_status = 'Approved'
    AND linked_project_id IS NOT NULL
  GROUP BY linked_project_id
) sub
WHERE p.id = sub.project_id;
