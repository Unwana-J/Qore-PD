import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type InvitePayload = {
  email: string;
  role: 'Manager' | 'Team Lead' | 'PM' | 'Finance' | 'Executive' | 'Superadmin';
  name?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const authHeader = req.headers.get('Authorization') || '';

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase function environment keys.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const {
      data: { user },
      error: authError
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const role = (profile?.role || '').toLowerCase();
    const allowed = ['manager', 'team lead', 'superadmin'];
    if (!allowed.includes(role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions to send invites.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = (await req.json()) as InvitePayload;
    const email = normalizeEmail(body.email || '');
    const inviteRole = body.role;
    const inviteName = (body.name || '').trim() || null;

    if (!email || !inviteRole) {
      return new Response(JSON.stringify({ error: 'Email and role are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Prevent inviting a user that already exists.
    const { data: existingProfile } = await adminClient.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: 'A user with this email already exists.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert invite metadata so role can be changed before acceptance.
    const { data: inviteRow, error: inviteError } = await adminClient
      .from('invites')
      .upsert(
        {
          email,
          name: inviteName,
          role: inviteRole,
          status: 'Pending',
          expires_at: expiresAt
        },
        { onConflict: 'email' }
      )
      .select()
      .single();

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const redirectTo = Deno.env.get('INVITE_REDIRECT_URL') || Deno.env.get('APP_URL') || undefined;

    const { error: emailInviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        name: inviteName || undefined
      }
    });

    if (emailInviteError) {
      return new Response(JSON.stringify({ error: emailInviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ invite: inviteRow }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unexpected error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
