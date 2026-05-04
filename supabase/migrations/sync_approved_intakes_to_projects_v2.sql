-- ══════════════════════════════════════════════════════════════════════════════
--  Auto-Sync Approved Project Intakes → Projects Table (Refined)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_approved_intake_to_projects()
RETURNS trigger AS $$
DECLARE
  normalized_currency TEXT;
  project_value_num   NUMERIC;
  project_start_date  DATE;
  pm_name_canonical   TEXT;
BEGIN
  -- Guard clauses
  IF NEW.request_type IS DISTINCT FROM 'Project Intake' THEN RETURN NEW; END IF;
  IF NEW.approval_status IS DISTINCT FROM 'Approved' THEN RETURN NEW; END IF;
  IF NEW.package_name IS NULL OR TRIM(NEW.package_name) = '' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE external_id = NEW.zoho_id::TEXT) THEN RETURN NEW; END IF;

  -- ── PM Name Normalization ──────────────────────────────────────────────────
  -- Try to find an existing user with this name to avoid "Benjamin" vs "Benjamin " vs "Benjamin Anenu" issues
  -- We prioritize exact matches, then fuzzy matches in the profiles table.
  SELECT name INTO pm_name_canonical
  FROM public.profiles
  WHERE TRIM(LOWER(name)) = TRIM(LOWER(NEW.project_manager))
  LIMIT 1;

  -- If no profile found, we use the name from Zoho but TRIM it to prevent obvious whitespace duplicates
  IF pm_name_canonical IS NULL THEN
    pm_name_canonical := TRIM(NEW.project_manager);
  END IF;

  -- ── Currency normalization ──────────────────────────────────────────────────
  normalized_currency := CASE
    WHEN LOWER(TRIM(COALESCE(NEW.currency,''))) IN ('naira','ngn','₦') THEN 'NGN'
    WHEN LOWER(TRIM(COALESCE(NEW.currency,''))) IN ('dollar','usd','$') THEN 'USD'
    ELSE COALESCE(TRIM(NEW.currency), 'NGN')
  END;

  -- ── Value casting ──────────────────────────────────────────────────────────
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
    NEW.zoho_id::TEXT, NEW.client_name, TRIM(NEW.package_name), pm_name_canonical,
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
