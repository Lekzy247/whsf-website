// WHSF grant alerts: deadline reminders (30/14/3 days) for saved grants and a weekly
// email of new matches, sent through WHSF's own Resend account to organisations that
// opted in. Every email carries a one-click unsubscribe link.
//
//   POST {}                         daily run (pg_cron); at most one run per 20 hours
//   POST { dry_run: true }          signed-in grants admin: report what would be sent
//   POST { force: true, weekly: true }  signed-in grants admin: run now, include the weekly email
//   POST ?unsubscribe=<token>       one-click unsubscribe (email client or grants-account.html)
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { verdict, type Org } from './match.ts';

const FUNCTION_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co/functions/v1/grant-alerts';
const SITE = 'https://www.worldhsfoundation.org';
const FROM = 'WHSF Grants <noreply@worldhsfoundation.org>';
const REPLY_TO = 'info@worldhsfoundation.org';
const MAX_EMAILS_PER_RUN = 90; // Resend free plan: 100 a day
const THRESHOLDS = [3, 14, 30] as const;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type OrgRow = Org & { id: string; owner_id: string; name: string; alerts_token: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const escapeHtml = (value: string) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] as string));
const safeUrl = (url: string) => (/^https:\/\//i.test(url || '') ? url : SITE + '/grants.html');
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (date: string) => Math.ceil((Date.parse(`${date}T23:59:59Z`) - Date.now()) / 864e5);
const formatDate = (date: string) => new Date(`${date}T12:00:00Z`)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function isoWeek(d = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function isAdminCaller(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await userClient.rpc('whsf_grants_is_admin');
  return data === true;
}

function layout(org: OrgRow, heading: string, intro: string, rows: string, footerNote: string) {
  const unsubscribe = `${SITE}/grants-account.html?unsubscribe=${org.alerts_token}`;
  return `<!doctype html><html><body style="margin:0;background:#fffdfa;font-family:Arial,Helvetica,sans-serif;color:#14221e">
<div style="max-width:620px;margin:0 auto;padding:28px 20px">
  <p style="margin:0 0 4px;color:#6d1024;font-size:12px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase">WHSF Grants</p>
  <h1 style="margin:0 0 12px;font-size:22px;color:#14221e">${escapeHtml(heading)}</h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.5">${intro}</p>
  ${rows}
  <p style="margin:22px 0 0"><a href="${SITE}/grants-account.html#matches" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#6d1024;color:#fff;text-decoration:none;font-weight:bold">Open my matches and tracker</a></p>
  <p style="margin:26px 0 0;font-size:12px;line-height:1.5;color:#6f5a5f">${footerNote}
  Always confirm eligibility and deadlines on the funder's own page.<br>
  You receive this because ${escapeHtml(org.name)} turned on grant emails at worldhsfoundation.org.
  <a href="${unsubscribe}" style="color:#6d1024">Unsubscribe</a> · World Humanitarian Support Foundation · Reply to this email to reach info@worldhsfoundation.org</p>
</div></body></html>`;
}

function grantRow(g: { title: string; funder_name: string; url: string; deadline: string | null }, note: string) {
  return `<div style="margin:0 0 12px;padding:14px 16px;border:1px solid #ead8dc;border-radius:14px;background:#fff">
  <a href="${escapeHtml(safeUrl(g.url))}" style="color:#6d1024;font-weight:bold;font-size:15px;text-decoration:none">${escapeHtml(g.title)}</a>
  <div style="margin-top:4px;font-size:13px;color:#6f5a5f">${escapeHtml(g.funder_name || '')}${g.deadline ? ` · Deadline ${escapeHtml(formatDate(g.deadline))}` : ''}</div>
  <div style="margin-top:6px;font-size:13px">${note}</div></div>`;
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string, unsubscribeToken: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], reply_to: REPLY_TO, subject, html,
      headers: {
        'List-Unsubscribe': `<${FUNCTION_URL}?unsubscribe=${unsubscribeToken}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).id as string;
}

async function unsubscribe(db: SupabaseClient, token: string | null) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false, error: 'Invalid link.' }, 400);
  const { data, error } = await db.from('whsf_grant_orgs').update({ alerts_opt_in: false, updated_at: new Date().toISOString() })
    .eq('alerts_token', token).select('name').maybeSingle();
  if (error) return json({ ok: false, error: 'Please try again later.' }, 500);
  if (!data) return json({ ok: false, error: 'This link is no longer valid.' }, 404);
  return json({ ok: true, name: data.name });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const url = new URL(req.url);
  if (url.searchParams.has('unsubscribe')) return unsubscribe(db, url.searchParams.get('unsubscribe'));
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let body: { dry_run?: boolean; force?: boolean; weekly?: boolean } = {};
  try { body = await req.json(); } catch { /* cron sends an empty body */ }
  const admin = (body.dry_run || body.force) ? await isAdminCaller(req) : false;
  if ((body.dry_run || body.force) && !admin) return json({ error: 'Grants administrator sign-in required.' }, 403);
  const dryRun = body.dry_run === true;

  if (!dryRun && !body.force) {
    const { data: recent } = await db.from('whsf_opportunity_sync_runs').select('id')
      .eq('source', 'grant_alerts').gte('started_at', new Date(Date.now() - 20 * 3.6e6).toISOString()).limit(1);
    if (recent?.length) return json({ skipped: 'Alerts already ran in the last 20 hours.' });
  }
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey && !dryRun) return json({ error: 'RESEND_API_KEY secret is not set.' }, 503);

  const { data: run } = dryRun ? { data: null } : await db.from('whsf_opportunity_sync_runs')
    .insert({ source: 'grant_alerts' }).select('id').single();

  const report = { orgs: 0, deadline_emails: 0, weekly_emails: 0, skipped_cap: 0, errors: [] as string[], preview: [] as unknown[] };
  try {
    const { data: orgs } = await db.from('whsf_grant_orgs').select('*').eq('alerts_opt_in', true);
    report.orgs = orgs?.length ?? 0;
    const orgIds = (orgs ?? []).map((o) => o.id);
    const { data: logRows } = orgIds.length
      ? await db.from('whsf_grant_alert_log').select('org_id,kind,opportunity_id,period').in('org_id', orgIds)
      : { data: [] };
    const sentKey = new Set((logRows ?? []).map((l) => `${l.org_id}|${l.kind}|${l.opportunity_id ?? ''}|${l.period}`));
    const week = isoWeek();
    const isMonday = new Date().getUTCDay() === 1;
    const sendWeekly = isMonday || body.weekly === true;
    let sent = 0;

    // New grants published in the last 7 days, for the weekly email.
    const { data: fresh } = sendWeekly
      ? await db.from('whsf_opportunities')
        .select('id,source,title,funder_name,url,countries,sectors,applicant_types,amount_max_usd,deadline,status')
        .eq('kind', 'grant').eq('review_status', 'published').neq('status', 'closed')
        .gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString())
        .or(`deadline.gte.${today()},deadline.is.null`).limit(500)
      : { data: [] };

    for (const org of (orgs ?? []) as OrgRow[]) {
      const { data: user } = await db.auth.admin.getUserById(org.owner_id);
      const email = user?.user?.email;
      if (!email || !user?.user?.email_confirmed_at) continue;

      // ---- deadline reminders: one email per organisation listing everything due
      const { data: savedRows } = await db.from('whsf_grant_saved')
        .select('opportunity_id,status,whsf_opportunities(id,title,funder_name,url,deadline,status,review_status)')
        .eq('org_id', org.id).in('status', ['interested', 'preparing']);
      const due: { kind: string; grant: any; days: number }[] = [];
      for (const s of savedRows ?? []) {
        const g = (s as any).whsf_opportunities;
        if (!g?.deadline || g.status === 'closed' || g.review_status !== 'published') continue;
        const days = daysUntil(g.deadline);
        if (days < 0) continue;
        const threshold = THRESHOLDS.find((t) => days <= t);
        if (!threshold) continue;
        const kind = `deadline_${threshold}`;
        if (sentKey.has(`${org.id}|${kind}|${g.id}|`)) continue;
        due.push({ kind, grant: g, days });
      }
      if (due.length) {
        due.sort((a, b) => a.days - b.days);
        const subject = due.length === 1
          ? `${due[0].days} day${due[0].days === 1 ? '' : 's'} left: ${due[0].grant.title}`.slice(0, 140)
          : `${due.length} grant deadlines coming up for ${org.name}`.slice(0, 140);
        const rows = due.map((d) => grantRow(d.grant,
          `<strong style="color:${d.days <= 3 ? '#8f1f24' : '#14221e'}">${d.days === 0 ? 'Closes today' : `${d.days} day${d.days === 1 ? '' : 's'} left`}</strong>`)).join('');
        const html = layout(org, 'Grant deadlines coming up',
          `These grants in ${escapeHtml(org.name)}'s tracker close soon. Update their status in your tracker when you submit.`,
          rows, 'Reminders are sent 30, 14 and 3 days before each deadline for grants marked "Interested" or "Preparing".');
        if (dryRun) report.preview.push({ to: email, subject, grants: due.map((d) => `${d.kind}: ${d.grant.title}`) });
        else if (sent >= MAX_EMAILS_PER_RUN) report.skipped_cap++;
        else {
          try {
            const id = await sendEmail(apiKey!, email, subject, html, org.alerts_token);
            sent++;
            report.deadline_emails++;
            await db.from('whsf_grant_alert_log').insert(due.map((d) => ({
              org_id: org.id, kind: d.kind, opportunity_id: d.grant.id, period: '', email_id: id,
            })));
          } catch (err) { report.errors.push(`${org.id}: ${(err as Error).message}`); }
        }
      }

      // ---- weekly new matches
      if (sendWeekly && !sentKey.has(`${org.id}|weekly||${week}`)) {
        const savedIds = new Set((savedRows ?? []).map((s) => s.opportunity_id));
        const matches = (fresh ?? [])
          .filter((g) => !savedIds.has(g.id))
          .map((g) => ({ g, ...verdict(g, org, today()) }))
          .filter((m) => m.verdict !== 'unlikely')
          .sort((a, b) => (a.verdict === b.verdict ? b.score - a.score : a.verdict === 'likely' ? -1 : 1))
          .slice(0, 10);
        if (matches.length) {
          const subject = `${matches.length} new grant${matches.length === 1 ? '' : 's'} matching ${org.name}`.slice(0, 140);
          const rows = matches.map((m) => grantRow(m.g, m.verdict === 'likely'
            ? '<span style="color:#1f7a4d;font-weight:bold">Likely eligible</span>'
            : '<span style="color:#a8701a;font-weight:bold">Check the details</span>')).join('');
          const html = layout(org, 'New grants that match your profile',
            `Published on the WHSF grants portal in the last week and matched to ${escapeHtml(org.name)}'s profile.`,
            rows, 'Weekly match emails are sent on Mondays when there are new matches.');
          if (dryRun) report.preview.push({ to: email, subject, grants: matches.map((m) => `${m.verdict}: ${m.g.title}`) });
          else if (sent >= MAX_EMAILS_PER_RUN) report.skipped_cap++;
          else {
            try {
              const id = await sendEmail(apiKey!, email, subject, html, org.alerts_token);
              sent++;
              report.weekly_emails++;
              await db.from('whsf_grant_alert_log').insert({ org_id: org.id, kind: 'weekly', period: week, email_id: id });
            } catch (err) { report.errors.push(`${org.id}: ${(err as Error).message}`); }
          }
        }
      }
    }
  } catch (err) {
    report.errors.push((err as Error).message);
  }

  if (run?.id) {
    await db.from('whsf_opportunity_sync_runs').update({
      finished_at: new Date().toISOString(), ok: report.errors.length === 0,
      inserted: report.deadline_emails + report.weekly_emails,
      message: `${report.deadline_emails} deadline + ${report.weekly_emails} weekly emails to ${report.orgs} opted-in orgs`
        + (report.skipped_cap ? `; ${report.skipped_cap} held for tomorrow (daily cap)` : '')
        + (report.errors.length ? `; errors: ${report.errors.join(' | ').slice(0, 300)}` : ''),
    }).eq('id', run.id);
  }
  return json(report);
});
