// ─────────────────────────────────────────────────────────────────────────────
//  send-weekly-digest  · Supabase Edge Function
//
//  Triggered by pg_cron every Monday at 08:00 UTC (09:00 WAT).
//  Fetches live data, computes the Implementation Digest, and emails
//  a role-scoped summary to every active user.
//
//  Email provider: Resend  (set RESEND_API_KEY in Supabase secrets)
//  From address  : set DIGEST_FROM_EMAIL in Supabase secrets
//                  e.g.  digest@qore-pd.app
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayKey(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

/** Fetch all rows from a table, bypassing Supabase's 1,000-row default cap */
async function fetchAllRows(supabase: any, table: string, filters: Record<string, any> = {}): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let keepGoing = true;
  while (keepGoing) {
    let q = supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    for (const [key, val] of Object.entries(filters)) {
      q = q.eq(key, val);
    }
    const { data, error } = await q;
    if (error) throw error;
    const page = data || [];
    allRows = allRows.concat(page);
    keepGoing = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allRows;
}

// ── Digest calculation ────────────────────────────────────────────────────────

function computeDigest(extensions: any[], forUser?: { name: string; role: string }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(today.getUTCDate() - 7);
  const nextSevenDays = new Date(today);
  nextSevenDays.setUTCDate(today.getUTCDate() + 7);

  const isIndividualIM = forUser?.role === 'IM';
  const scoped = isIndividualIM
    ? extensions.filter(e => e.implementation_manager?.trim().toLowerCase() === forUser!.name.trim().toLowerCase())
    : extensions;

  const active = scoped.filter(e => e.status !== 'Completed' && e.status !== 'Suspended' && e.status !== 'Frozen');
  const overdue = active.filter(e =>
    e.target_closure_date && new Date(e.target_closure_date) < today &&
    !e.service_name?.toLowerCase().includes('api')
  );
  const completedThisWeek = scoped.filter(e =>
    e.status === 'Completed' && new Date(e.updated_at) >= sevenDaysAgo
  );
  const openIssues = scoped.reduce((acc: number, e: any) =>
    acc + ((e.issues || []).filter((i: any) => i.status !== 'Closed').length), 0);
  const upcomingDeadlines = active
    .filter(e => {
      if (!e.target_closure_date) return false;
      const d = new Date(e.target_closure_date);
      return !isNaN(d.getTime()) && d >= today && d <= nextSevenDays;
    })
    .sort((a: any, b: any) => new Date(a.target_closure_date).getTime() - new Date(b.target_closure_date).getTime())
    .slice(0, 8);

  // IM Activity (only for leads/admins)
  const imActivity: Record<string, any> = {};
  if (!isIndividualIM) {
    extensions.forEach(e => {
      const im = e.implementation_manager;
      if (!im) return;
      if (!imActivity[im]) imActivity[im] = { name: im, active: 0, overdue: 0, daysSinceUpdate: 0 };
      const isActive = e.status !== 'Completed' && e.status !== 'Suspended' && e.status !== 'Frozen';
      if (isActive) {
        imActivity[im].active++;
        if (e.target_closure_date && new Date(e.target_closure_date) < today && !e.service_name?.toLowerCase().includes('api')) {
          imActivity[im].overdue++;
        }
        const daysSince = Math.floor((today.getTime() - new Date(e.updated_at).getTime()) / 86400000);
        if (daysSince > imActivity[im].daysSinceUpdate) imActivity[im].daysSinceUpdate = daysSince;
      }
    });
  }

  const pendingMappings = (isIndividualIM ? scoped : extensions).filter(e => e.mapping_status === 'Pending').length;
  const pendingSuspensions = (isIndividualIM ? scoped : extensions).filter(e => e.suspension_request?.status === 'Pending').length;
  const pendingExtensions = (isIndividualIM ? scoped : extensions).filter(e => e.extension_request?.status === 'Pending').length;

  return {
    weekOf: getMondayKey(),
    totalActive: active.length,
    overdueCount: overdue.length,
    completedThisWeek: completedThisWeek.length,
    openIssues,
    upcomingDeadlines,
    pendingMappings,
    pendingSuspensions,
    pendingExtensions,
    imActivity: Object.values(imActivity).filter((im: any) => im.active > 0).sort((a: any, b: any) => b.daysSinceUpdate - a.daysSinceUpdate),
    isPersonal: isIndividualIM,
  };
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmailHtml(digest: ReturnType<typeof computeDigest>, recipientName: string, isPersonal: boolean, appUrl: string): string {
  const { weekOf, totalActive, overdueCount, completedThisWeek, openIssues, upcomingDeadlines, pendingMappings, pendingSuspensions, pendingExtensions, imActivity } = digest;

  const overdueColor = overdueCount > 0 ? '#dc2626' : '#10b981';
  const sectionTitle = isPersonal ? 'Your Portfolio Health' : 'Team Portfolio Health';
  const reviewTitle = isPersonal ? 'Your Review Items' : 'Review Queue';

  const deadlinesHtml = upcomingDeadlines.length === 0
    ? `<p style="color:#94a3b8;font-style:italic;margin:0">No deadlines approaching in the next 7 days.</p>`
    : upcomingDeadlines.map((d: any) => {
        const daysLeft = Math.ceil((new Date(d.target_closure_date).getTime() - new Date().getTime()) / 86400000);
        const color = daysLeft < 0 ? '#dc2626' : daysLeft <= 3 ? '#f59e0b' : '#10b981';
        const label = daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`;
        return `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9">
            <strong style="color:#0f172a;font-size:13px">${d.client_name}</strong>
            <span style="color:#94a3b8;font-size:11px;margin-left:6px;text-transform:uppercase">${d.service_name}${d.implementation_manager ? ` · ${d.implementation_manager}` : ''}</span>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right">
            <span style="background:${color}15;color:${color};padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700">${label}</span>
          </td>
        </tr>`;
      }).join('');

  const imActivityHtml = !isPersonal && imActivity.length > 0
    ? `<div style="margin-top:24px">
        <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Team Activity Sync</p>
        ${imActivity.slice(0, 8).map((im: any) => {
          const dotColor = im.daysSinceUpdate >= 14 ? '#ef4444' : im.daysSinceUpdate >= 7 ? '#f59e0b' : '#10b981';
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:8px;height:8px;border-radius:50%;background:${dotColor};flex-shrink:0"></div>
              <div>
                <p style="margin:0;font-size:13px;font-weight:600;color:#0f172a">${im.name}</p>
                <p style="margin:0;font-size:11px;color:#94a3b8">${im.active} active${im.overdue > 0 ? ` · <span style="color:#ef4444">${im.overdue} overdue</span>` : ''}</p>
              </div>
            </div>
            <span style="font-size:11px;font-weight:700;color:#64748b">${im.daysSinceUpdate}d ago</span>
          </div>`;
        }).join('')}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
    
    <!-- Header -->
    <div style="background:#0f172a;padding:32px 40px;position:relative">
      <p style="margin:0 0 4px;font-size:10px;font-weight:800;color:#2dd4bf;text-transform:uppercase;letter-spacing:0.15em">Implementation Digest</p>
      <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff">Weekly Review Snapshot</h1>
      <p style="margin:8px 0 0;font-size:12px;color:#64748b">Week of ${weekOf} &nbsp;·&nbsp; Hi ${recipientName.split(' ')[0]} 👋</p>
    </div>

    <div style="padding:32px 40px">

      <!-- KPI Grid -->
      <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px">${sectionTitle}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px">
        <tr>
          <td style="width:25%;padding-right:8px">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
              <p style="margin:0;font-size:28px;font-weight:900;color:#0f172a">${totalActive}</p>
              <p style="margin:4px 0 0;font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase">Active</p>
            </div>
          </td>
          <td style="width:25%;padding:0 4px">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center">
              <p style="margin:0;font-size:28px;font-weight:900;color:#16a34a">${completedThisWeek}</p>
              <p style="margin:4px 0 0;font-size:9px;font-weight:700;color:#86efac;text-transform:uppercase">Completed</p>
            </div>
          </td>
          <td style="width:25%;padding:0 4px">
            <div style="background:${overdueCount > 0 ? '#fef2f2' : '#f8fafc'};border:1px solid ${overdueCount > 0 ? '#fecaca' : '#e2e8f0'};border-radius:12px;padding:16px;text-align:center">
              <p style="margin:0;font-size:28px;font-weight:900;color:${overdueColor}">${overdueCount}</p>
              <p style="margin:4px 0 0;font-size:9px;font-weight:700;color:${overdueCount > 0 ? '#fca5a5' : '#94a3b8'};text-transform:uppercase">Overdue</p>
            </div>
          </td>
          <td style="width:25%;padding-left:8px">
            <div style="background:${openIssues > 0 ? '#fffbeb' : '#f8fafc'};border:1px solid ${openIssues > 0 ? '#fde68a' : '#e2e8f0'};border-radius:12px;padding:16px;text-align:center">
              <p style="margin:0;font-size:28px;font-weight:900;color:${openIssues > 0 ? '#d97706' : '#cbd5e1'}">${openIssues}</p>
              <p style="margin:4px 0 0;font-size:9px;font-weight:700;color:${openIssues > 0 ? '#fcd34d' : '#94a3b8'};text-transform:uppercase">Open Issues</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Review Queue -->
      ${(pendingMappings > 0 || pendingSuspensions > 0 || pendingExtensions > 0) ? `
      <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">${reviewTitle}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px">
        <tr>
          ${pendingMappings > 0 ? `<td style="padding-right:8px"><div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px;text-align:center"><p style="margin:0;font-size:22px;font-weight:900;color:#4338ca">${pendingMappings}</p><p style="margin:4px 0 0;font-size:9px;color:#818cf8;font-weight:700;text-transform:uppercase">Pending Mappings</p></div></td>` : ''}
          ${pendingSuspensions > 0 ? `<td style="padding:0 4px"><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center"><p style="margin:0;font-size:22px;font-weight:900;color:#d97706">${pendingSuspensions}</p><p style="margin:4px 0 0;font-size:9px;color:#fbbf24;font-weight:700;text-transform:uppercase">Pending Suspensions</p></div></td>` : ''}
          ${pendingExtensions > 0 ? `<td style="padding-left:8px"><div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:14px;text-align:center"><p style="margin:0;font-size:22px;font-weight:900;color:#e11d48">${pendingExtensions}</p><p style="margin:4px 0 0;font-size:9px;color:#fb7185;font-weight:700;text-transform:uppercase">Pending Extensions</p></div></td>` : ''}
        </tr>
      </table>` : ''}

      <!-- Upcoming Deadlines -->
      <p style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Upcoming Deadlines (7 Days)</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px">
        ${deadlinesHtml}
      </table>

      <!-- Team Activity Sync (leads/admins only) -->
      ${imActivityHtml}

      <!-- CTA -->
      <div style="text-align:center;margin-top:32px">
        <a href="${appUrl}/implementations" style="display:inline-block;background:#0d9488;color:#ffffff;font-weight:800;font-size:13px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.05em">Open Dashboard →</a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center">
      <p style="margin:0;font-size:11px;color:#94a3b8">Qore PD · Solution Delivery Platform &nbsp;·&nbsp; This digest was auto-generated on ${new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail    = Deno.env.get('DIGEST_FROM_EMAIL') || 'digest@qore-pd.app';
  const appUrl       = Deno.env.get('APP_URL') || 'https://qore-pd.vercel.app';
  const supabaseUrl  = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured.' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch all extensions (paginated to bypass 1k cap)
    const extensions = await fetchAllRows(supabase, 'service_extensions');

    // 2. Fetch active profiles with emails
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, role, email, status')
      .neq('status', 'Inactive');

    if (profilesError) throw profilesError;
    const profiles = (profilesData || []).filter((p: any) =>
      p.email && ['Superadmin', 'Manager', 'IM Lead', 'Team Lead', 'IM'].includes(p.role)
    );

    const results: Array<{ email: string; status: string }> = [];

    // 3. Send a role-scoped digest to each recipient
    for (const profile of profiles) {
      const isPersonal = profile.role === 'IM';
      const digest = computeDigest(extensions, { name: profile.name, role: profile.role });
      const html = buildEmailHtml(digest, profile.name, isPersonal, appUrl);

      const subject = isPersonal
        ? `📋 Your Weekly Implementation Digest — ${digest.weekOf}`
        : `📊 Weekly Implementation Digest — ${digest.weekOf}`;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [profile.email],
          subject,
          html,
        }),
      });

      const resBody = await res.json().catch(() => ({}));
      results.push({ email: profile.email, status: res.ok ? 'sent' : `failed: ${JSON.stringify(resBody)}` });
    }

    // 4. Archive the team-wide digest to the DB
    const teamDigest = computeDigest(extensions);
    await supabase.from('implementation_digests').upsert({
      week_of: teamDigest.weekOf,
      data: { ...teamDigest, generatedAt: new Date().toISOString() }
    }, { onConflict: 'week_of' });

    return new Response(JSON.stringify({ success: true, sent: results.length, results }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[send-weekly-digest] Error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Unexpected error' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});
