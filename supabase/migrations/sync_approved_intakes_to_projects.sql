-- ══════════════════════════════════════════════════════════════════════════════
--  Auto-Sync Approved Project Intakes → Projects Table
--
--  Run in Supabase SQL Editor in order:
--    STEP 1: Add external_id column
--    STEP 2: Create trigger function + attach trigger
--    STEP 3: (Optional) Backfill existing approved intakes
--
--  Conditions to create a project:
--    1. request_type = 'Project Intake'
--    2. approval_status = 'Approved'
--    3. package_name IS NOT NULL (rows without a package are skipped)
--  Idempotency: ON CONFLICT (external_id) DO NOTHING
-- ══════════════════════════════════════════════════════════════════════════════


-- ── STEP 1: Add external_id column to projects ────────────────────────────────
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS external_id TEXT UNIQUE;


-- ── STEP 2: Trigger function + trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_approved_intake_to_projects()
RETURNS trigger AS $$
DECLARE
  normalized_currency TEXT;
  project_value_num   NUMERIC;
  project_start_date  DATE;
BEGIN
  -- Guard clauses
  IF NEW.request_type IS DISTINCT FROM 'Project Intake' THEN RETURN NEW; END IF;
  IF NEW.approval_status IS DISTINCT FROM 'Approved' THEN RETURN NEW; END IF;
  IF NEW.package_name IS NULL OR TRIM(NEW.package_name) = '' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE external_id = NEW.zoho_id::TEXT) THEN RETURN NEW; END IF;

  -- Currency normalization
  normalized_currency := CASE
    WHEN LOWER(TRIM(COALESCE(NEW.currency,''))) IN ('naira','ngn','₦') THEN 'NGN'
    WHEN LOWER(TRIM(COALESCE(NEW.currency,''))) IN ('dollar','usd','$') THEN 'USD'
    ELSE COALESCE(TRIM(NEW.currency), 'NGN')
  END;

  -- Value casting (strip formatting, cast to numeric)
  project_value_num := COALESCE(
    NULLIF(regexp_replace(COALESCE(NEW.project_value::TEXT,'0'),'[^0-9.]','','g'),'')::NUMERIC, 0
  );

  project_start_date := COALESCE(NEW.created_date, NOW()::DATE);

  INSERT INTO public.projects (
    external_id, client_name, package_name, assigned_pm,
    value, currency, state, priority,
    start_date, expected_duration,
    expected_completion_date, current_completion_date,
    delivery_track, is_internal_initiative,
    services, product_lines, phases, phase_weights,
    service_states, comments, risks, activities,
    rebaseline_requests, suspension_cycles, milestones
  ) VALUES (
    NEW.zoho_id::TEXT, NEW.client_name, TRIM(NEW.package_name), TRIM(NEW.project_manager),
    project_value_num, normalized_currency, 'On-Track',
    CASE WHEN LOWER(TRIM(COALESCE(NEW.priority,''))) = 'high' THEN 'P2' ELSE 'P3' END,
    project_start_date,
    90,
    project_start_date + INTERVAL '90 days',
    project_start_date + INTERVAL '90 days',
    'Standard', FALSE,
    '[]','[]',
    '[{"id":"Initiation","name":"Initiation","status":"Pending"},{"id":"Planning","name":"Planning","status":"Locked"},{"id":"Execution","name":"Execution","status":"Locked"},{"id":"Closure","name":"Closure","status":"Locked"}]',
    '{"initiation":10,"planning":20,"execution":60,"closure":10}',
    '{}','[]','[]','[]','[]','[]','[]'
  )
  ON CONFLICT (external_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_intake_approved ON public.project_product_log;
CREATE TRIGGER on_intake_approved
  AFTER INSERT OR UPDATE OF approval_status
  ON public.project_product_log
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_approved_intake_to_projects();


-- ── STEP 3: One-time backfill for existing approved intakes ───────────────────
--  Run this ONCE after deploying the trigger.
--  Safe to re-run — idempotent via ON CONFLICT DO NOTHING.
DO $$
DECLARE
  r RECORD;
  normalized_currency TEXT;
  project_value_num   NUMERIC;
  project_start_date  DATE;
BEGIN
  FOR r IN
    SELECT *
    FROM public.project_product_log
    WHERE request_type    = 'Project Intake'
      AND approval_status = 'Approved'
      AND package_name    IS NOT NULL
      AND TRIM(package_name) != ''
    ORDER BY created_date ASC
  LOOP
    IF EXISTS (SELECT 1 FROM public.projects WHERE external_id = r.zoho_id::TEXT) THEN
      CONTINUE;
    END IF;

    normalized_currency := CASE
      WHEN LOWER(TRIM(COALESCE(r.currency,''))) IN ('naira','ngn','₦') THEN 'NGN'
      WHEN LOWER(TRIM(COALESCE(r.currency,''))) IN ('dollar','usd','$') THEN 'USD'
      ELSE COALESCE(TRIM(r.currency), 'NGN')
    END;

    project_value_num := COALESCE(
      NULLIF(regexp_replace(COALESCE(r.project_value::TEXT,'0'),'[^0-9.]','','g'),'')::NUMERIC, 0
    );

    project_start_date := COALESCE(r.created_date, NOW()::DATE);

    INSERT INTO public.projects (
      external_id, client_name, package_name, assigned_pm,
      value, currency, state, priority,
      start_date, expected_duration,
      expected_completion_date, current_completion_date,
      delivery_track, is_internal_initiative,
      services, product_lines, phases, phase_weights,
      service_states, comments, risks, activities,
      rebaseline_requests, suspension_cycles, milestones
    ) VALUES (
      r.zoho_id::TEXT, r.client_name, TRIM(r.package_name), TRIM(r.project_manager),
      project_value_num, normalized_currency, 'On-Track',
      CASE WHEN LOWER(TRIM(COALESCE(r.priority,''))) = 'high' THEN 'P2' ELSE 'P3' END,
      project_start_date,
      90,
      project_start_date + INTERVAL '90 days',
      project_start_date + INTERVAL '90 days',
      'Standard', FALSE,
      '[]','[]',
      '[{"id":"Initiation","name":"Initiation","status":"Pending"},{"id":"Planning","name":"Planning","status":"Locked"},{"id":"Execution","name":"Execution","status":"Locked"},{"id":"Closure","name":"Closure","status":"Locked"}]',
      '{"initiation":10,"planning":20,"execution":60,"closure":10}',
      '{}','[]','[]','[]','[]','[]','[]'
    )
    ON CONFLICT (external_id) DO NOTHING;

  END LOOP;

  RAISE NOTICE 'Backfill complete.';
END $$;
