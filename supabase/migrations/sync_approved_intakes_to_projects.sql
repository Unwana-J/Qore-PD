-- ══════════════════════════════════════════════════════════════════════════════
--  Auto-Sync Approved Project Intakes → Projects Table
--
--  Trigger: fires AFTER INSERT OR UPDATE on project_product_log
--  Conditions to create a project:
--    1. request_type = 'Project Intake'
--    2. approval_status = 'Approved'
--    3. package_name IS NOT NULL (rows without a package are skipped)
--  Idempotency: ON CONFLICT (external_id) DO NOTHING
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_approved_intake_to_projects()
RETURNS trigger AS $$
DECLARE
  normalized_currency TEXT;
  project_value_num   NUMERIC;
BEGIN
  -- ── Guard clauses ─────────────────────────────────────────────────────────

  -- Only process Project Intake rows
  IF NEW.request_type IS DISTINCT FROM 'Project Intake' THEN
    RETURN NEW;
  END IF;

  -- Only process when Approved
  IF NEW.approval_status IS DISTINCT FROM 'Approved' THEN
    RETURN NEW;
  END IF;

  -- Skip rows without a package_name (they don't have the required structure)
  IF NEW.package_name IS NULL OR TRIM(NEW.package_name) = '' THEN
    RETURN NEW;
  END IF;

  -- Skip if this zoho_id is already in the projects table (idempotent)
  IF EXISTS (
    SELECT 1 FROM public.projects WHERE external_id = NEW.zoho_id
  ) THEN
    RETURN NEW;
  END IF;

  -- ── Field transformations ─────────────────────────────────────────────────

  -- Currency normalization (intake stores human-readable strings)
  normalized_currency := CASE
    WHEN LOWER(TRIM(COALESCE(NEW.currency, ''))) IN ('naira', 'ngn', '₦') THEN 'NGN'
    WHEN LOWER(TRIM(COALESCE(NEW.currency, ''))) IN ('dollar', 'usd', '$') THEN 'USD'
    ELSE COALESCE(TRIM(NEW.currency), 'NGN')
  END;

  -- Value casting (stored as TEXT in some configurations — strip formatting)
  project_value_num := COALESCE(
    NULLIF(
      regexp_replace(COALESCE(NEW.project_value::TEXT, '0'), '[^0-9.]', '', 'g'),
      ''
    )::NUMERIC,
    0
  );

  -- ── Insert project ────────────────────────────────────────────────────────
  INSERT INTO public.projects (
    external_id,
    client_name,
    package_name,
    assigned_pm,
    value,
    currency,
    state,
    priority,
    start_date,
    delivery_track,
    is_internal_initiative,
    services,
    product_lines,
    phases,
    phase_weights,
    service_states,
    comments,
    risks,
    activities,
    rebaseline_requests,
    suspension_cycles,
    milestones
  ) VALUES (
    NEW.zoho_id,
    NEW.client_name,
    TRIM(NEW.package_name),
    TRIM(NEW.project_manager),    -- strips the triple-space formatting from Zoho
    project_value_num,
    normalized_currency,
    'On-Track',
    -- Map Zoho priority to internal priority tiers
    CASE
      WHEN LOWER(TRIM(COALESCE(NEW.priority, ''))) = 'high'   THEN 'P2'
      WHEN LOWER(TRIM(COALESCE(NEW.priority, ''))) = 'medium' THEN 'P3'
      ELSE 'P2'
    END,
    COALESCE(NEW.created_date::TEXT, NOW()::DATE::TEXT),
    'Standard',
    FALSE,
    '[]'::jsonb,
    '[]'::jsonb,
    '[
      {"id":"Initiation","name":"Initiation","status":"Pending"},
      {"id":"Planning",  "name":"Planning",  "status":"Locked"},
      {"id":"Execution", "name":"Execution", "status":"Locked"},
      {"id":"Closure",   "name":"Closure",   "status":"Locked"}
    ]'::jsonb,
    '{"initiation":10,"planning":20,"execution":60,"closure":10}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  )
  ON CONFLICT (external_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger (safe to run repeatedly)
DROP TRIGGER IF EXISTS on_intake_approved ON public.project_product_log;
CREATE TRIGGER on_intake_approved
  AFTER INSERT OR UPDATE OF approval_status
  ON public.project_product_log
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_approved_intake_to_projects();


-- ══════════════════════════════════════════════════════════════════════════════
--  ONE-TIME BACKFILL (optional)
--
--  Run this ONCE after deploying the trigger to promote existing approved
--  intakes that have a package_name but haven't been synced yet.
--
--  Comment out after running to avoid accidental re-execution.
-- ══════════════════════════════════════════════════════════════════════════════
/*
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM public.project_product_log
    WHERE request_type    = 'Project Intake'
      AND approval_status = 'Approved'
      AND package_name    IS NOT NULL
      AND TRIM(package_name) != ''
    ORDER BY created_date ASC   -- oldest first so newest wins on duplicate zoho_id
  LOOP
    -- Fire the same logic by updating a no-op field to trigger the row-level trigger
    -- Or just call the function inline — safest approach is direct INSERT:
    INSERT INTO public.projects (
      external_id, client_name, package_name, assigned_pm,
      value, currency, state, priority, start_date,
      delivery_track, is_internal_initiative,
      services, product_lines, phases, phase_weights,
      service_states, comments, risks, activities,
      rebaseline_requests, suspension_cycles, milestones
    ) VALUES (
      r.zoho_id,
      r.client_name,
      TRIM(r.package_name),
      TRIM(r.project_manager),
      COALESCE(NULLIF(regexp_replace(COALESCE(r.project_value::TEXT,'0'), '[^0-9.]','','g'),'')::NUMERIC, 0),
      CASE WHEN LOWER(TRIM(COALESCE(r.currency,''))) IN ('naira','ngn','₦') THEN 'NGN' ELSE COALESCE(TRIM(r.currency),'NGN') END,
      'On-Track',
      CASE WHEN LOWER(TRIM(COALESCE(r.priority,''))) = 'high' THEN 'P2' ELSE 'P3' END,
      COALESCE(r.created_date::TEXT, NOW()::DATE::TEXT),
      'Standard', FALSE,
      '[]','[]',
      '[{"id":"Initiation","name":"Initiation","status":"Pending"},{"id":"Planning","name":"Planning","status":"Locked"},{"id":"Execution","name":"Execution","status":"Locked"},{"id":"Closure","name":"Closure","status":"Locked"}]',
      '{"initiation":10,"planning":20,"execution":60,"closure":10}',
      '{}','[]','[]','[]','[]','[]','[]'
    )
    ON CONFLICT (external_id) DO NOTHING;
  END LOOP;
END $$;
*/
