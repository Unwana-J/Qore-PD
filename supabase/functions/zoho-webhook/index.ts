import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.4";

// This is the main edge function for processing incoming Zoho/Data warehouse webhooks.
// It authenticates the request against the pre-shared secret, validates the payload,
// and upserts the project data.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Authenticate Request
    // Fetch the stored webhook secret from the app_config table
    const { data: configData } = await supabase
      .from('app_config')
      .select('config')
      .eq('id', 'default')
      .single();

    const storedSecret = configData?.config?.webhookSecret;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (!storedSecret || !providedSecret || storedSecret !== providedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing webhook secret.' }), { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    // 2. Parse Payload
    const payload = await req.json();

    // -------------------------------------------------------------------------
    //   WAITING ON ENGINEERING TEAM
    //   Once the sample payload is received, map the fields here.
    // -------------------------------------------------------------------------
    //
    // Example anticipated mapping (to be updated once exact JSON is confirmed):
    // 
    // const externalId = payload.zoho_record_id;
    // const clientName = payload.client_business_name;
    // const PMName = payload.pm_name; 
    // const pmEmail = payload.pm_email;
    //
    // 3. Optional: Map PM email to existing User record ID...
    // 4. Upsert project to `projects` table using `external_id`
    // const projectData = {
    //    external_id: externalId,
    //    client_name: clientName,
    //    assigned_pm: PMName,
    //    value: payload.value,
    //    currency: payload.currency,
    //    // map defaults...
    // };
    
    // await supabase.from('projects').upsert(projectData, { onConflict: 'external_id' });

    console.log("Webhook payload received. Mapping logic pending.", payload);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Request authenticated and received. Schema mapping pending.' 
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});
