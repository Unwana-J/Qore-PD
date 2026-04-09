import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// ─────────────────────────────────────────────────────────────────────────────
//  zoho-webhook Edge Function
//  Receives project creation/update events from the Zoho CRM / Data Warehouse.
//
//  Authentication:  X-Webhook-Secret header must match the secret stored in
//                   app_config → webhookSecret (managed via Settings → Integrations)
//
//  Idempotency:     Upserts on external_id so repeated payloads for the same
//                   project are safe (they update, not duplicate).
//
//  TO ACTIVATE:     Replace the placeholder field names below with the actual
//                   JSON keys from the data warehouse payload, then uncomment
//                   the `projectData` block and the upsert call.
// ─────────────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-webhook-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Step 1: Authenticate ──────────────────────────────────────────────────
    const { data: configData } = await supabase
      .from('app_config')
      .select('config')
      .eq('id', 1)
      .single();

    const storedSecret   = configData?.config?.webhookSecret;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!storedSecret || !providedSecret || storedSecret !== providedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or missing webhook secret.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 2: Parse Payload ─────────────────────────────────────────────────
    const payload = await req.json();
    console.log('[zoho-webhook] Payload received:', JSON.stringify(payload));

    // ── Step 3: Map Fields ────────────────────────────────────────────────────
    // TODO: Replace each placeholder key (e.g. payload.zoho_record_id) with the
    //       exact key name from the data warehouse JSON payload once confirmed.
    //
    // ┌─────────────────────────────────────────────────────────────────────┐
    // │  WAITING ON ENGINEERING TEAM — confirm the exact JSON field names   │
    // │  then uncomment the block below and redeploy this function.         │
    // └─────────────────────────────────────────────────────────────────────┘
    //
    // const externalId   = payload.zoho_record_id;           // ← CONFIRM KEY
    // const clientName   = payload.client_business_name;     // ← CONFIRM KEY
    // const assignedPM   = payload.pm_name;                  // ← CONFIRM KEY
    // const packageName  = payload.package_name ?? 'TBD';    // ← CONFIRM KEY
    // const value        = Number(payload.contract_value) || 0;  // ← CONFIRM KEY
    // const currency     = payload.currency ?? 'NGN';        // ← CONFIRM KEY
    // const startDate    = payload.go_live_date              // ← CONFIRM KEY
    //   ?? new Date().toISOString().split('T')[0];
    //
    // const projectData = {
    //   external_id:              externalId,
    //   client_name:              clientName,
    //   package_name:             packageName,
    //   assigned_pm:              assignedPM,
    //   value:                    value,
    //   currency:                 currency,
    //   start_date:               startDate,
    //   state:                    'On-Track',
    //   priority:                 'P2',
    //   delivery_track:           'Standard',
    //   is_internal_initiative:   false,
    //   services:                 [],
    //   product_lines:            [],
    //   phases: [
    //     { id: 'Initiation', name: 'Initiation', status: 'Pending' },
    //     { id: 'Planning',   name: 'Planning',   status: 'Locked'  },
    //     { id: 'Execution',  name: 'Execution',  status: 'Locked'  },
    //     { id: 'Closure',    name: 'Closure',    status: 'Locked'  },
    //   ],
    //   phase_weights:     { initiation: 10, planning: 20, execution: 60, closure: 10 },
    //   service_states:    {},
    //   comments:          [],
    //   risks:             [],
    //   activities:        [],
    //   rebaseline_requests: [],
    //   suspension_cycles:   [],
    //   milestones:          [],
    // };
    //
    // const { error: upsertError } = await supabase
    //   .from('projects')
    //   .upsert(projectData, { onConflict: 'external_id' });
    //
    // if (upsertError) {
    //   console.error('[zoho-webhook] Upsert failed:', upsertError);
    //   return new Response(
    //     JSON.stringify({ error: 'Failed to upsert project.', detail: upsertError.message }),
    //     { status: 500, headers: { 'Content-Type': 'application/json' } }
    //   );
    // }
    //
    // console.log('[zoho-webhook] Project upserted successfully:', externalId);

    // ── Step 4: Respond ───────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Request authenticated and received. Field mapping pending engineering confirmation.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );

  } catch (error) {
    console.error('[zoho-webhook] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
