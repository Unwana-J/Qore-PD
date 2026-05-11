-- ─────────────────────────────────────────────────────────────────────────────
--  Schedule: Weekly Implementation Digest Email
--  Fires every Monday at 08:00 UTC = 09:00 WAT (West Africa Time, UTC+1)
--
--  Requires:
--    · pg_cron extension enabled (Supabase: Database → Extensions → pg_cron)
--    · pg_net extension enabled  (Supabase: Database → Extensions → pg_net)
--    · Edge Function deployed: send-weekly-digest
--    · Supabase secrets set:
--        RESEND_API_KEY      — your Resend.com API key
--        DIGEST_FROM_EMAIL   — the From address (e.g. digest@qore-pd.app)
--        APP_URL             — https://qore-pd.vercel.app
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable extensions (safe to run multiple times)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Remove any previous version of this job before re-scheduling
select cron.unschedule('send-weekly-implementation-digest')
where exists (
  select 1 from cron.job where jobname = 'send-weekly-implementation-digest'
);

-- 3. Schedule the job
--    Cron syntax: minute  hour  dom  month  dow
--                   0      8    *     *      1   => Every Monday at 08:00 UTC
select cron.schedule(
  'send-weekly-implementation-digest',   -- job name (unique)
  '0 8 * * 1',                           -- every Monday 08:00 UTC
  $$
    select net.http_post(
      url    := (
        select value
        from pg_catalog.pg_settings
        where name = 'app.supabase_url'
      ) || '/functions/v1/send-weekly-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (
          select value
          from pg_catalog.pg_settings
          where name = 'app.supabase_service_role_key'
        )
      ),
      body   := '{}'::jsonb
    );
  $$
);

-- 4. Verify the schedule was created
select jobid, jobname, schedule, command
from cron.job
where jobname = 'send-weekly-implementation-digest';
