// Daily organisation safety check (Vercel Cron, see vercel.json). Owner rule 2026-10-16: security first whenever an
// organisation adds a link or anything suspicious.
// 1. Opens every organisation website (grants portal + Forum organisations). A site that does not open on two daily
//    checks in a row quarantines a grants-portal organisation (alerts stop) and flags a Forum organisation.
// 2. Tells WHSF (email + Teams) about organisations newly quarantined or unverified (org_safety_new_flags), including
//    ones the database flagged when they registered (e.g. a US 501(c)(3) claim from outside the US).
// WHSF then decides: confirm, ask for proof, or remove (removed records are archived in whsf_removed_records).
// Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>". Database calls use JOBS_INGEST_SECRET.

import { postToTeams } from './_teams.js';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 WHSF-SafetyCheck';
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function rpc(name, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${name}: ${body?.message || res.status}`);
  return body;
}

// A website "opens" when it answers with a page (2xx/3xx). 401/403/429 also count as open: the site exists but
// refuses robots. DNS errors, timeouts and 404/410/5xx count as not opening.
async function opens(url) {
  if (!/^https:\/\//i.test(url || '')) return false;
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(15000) });
      if (res.status < 400 || [401, 403, 429].includes(res.status)) return true;
      if (method === 'GET') return false;
    } catch { if (method === 'GET') return false; }
  }
  return false;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const cronSecret = process.env.CRON_SECRET;
  const syncSecret = process.env.JOBS_INGEST_SECRET;
  if (!cronSecret || !syncSecret) return response.status(503).json({ error: 'Not configured.' });
  if (request.headers.authorization !== `Bearer ${cronSecret}`) return response.status(401).json({ error: 'Not allowed.' });

  const problems = [];
  let targets = [];
  try { targets = await rpc('org_safety_targets', { p_secret: syncSecret }); } catch (err) { problems.push(err.message); }
  const results = [];
  for (const t of targets || []) results.push({ kind: t.kind, id: t.id, ok: await opens(t.website), name: t.name, website: t.website });

  let dead = [];
  try { dead = await rpc('org_safety_report', { p_secret: syncSecret, p_results: results.map(({ kind, id, ok }) => ({ kind, id, ok })) }); } catch (err) { problems.push(err.message); }
  let flagged = [];
  try { flagged = await rpc('org_safety_new_flags', { p_secret: syncSecret }); } catch (err) { problems.push(err.message); }

  const items = [
    ...(flagged || []).map((o) => ({ title: `${o.name} (${o.country || 'country not given'})`, status: o.status === 'quarantined' ? 'Quarantined: grant alerts stopped' : 'Unverified: please review',
      detail: (o.flags || []).join('; '), website: o.website || 'no website', who: o.email || '' })),
    ...(dead || []).filter((d) => d.kind === 'forum_org').map((d) => ({ title: `${d.name} (Forum organisation)`, status: `Website not opening (status: ${d.status})`,
      detail: (d.flags || []).join('; '), website: d.website, who: '' }))
  ];

  let alerted = false;
  if (items.length) {
    const title = `WHSF safety check: ${items.length} organisation${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} review`;
    const facts = items.map((i) => [i.title, `${i.status}. ${i.detail}. Website: ${i.website}${i.who ? `. Sign-in email: ${i.who}` : ''}`]);
    const note = 'Decide for each: confirm it, ask for proof, or ask Claude to remove it (a copy is archived and can be restored).';
    alerted = await postToTeams(title, facts, null, note).catch(() => false);
    const apiKey = process.env.RESEND_API_KEY; const from = process.env.CONTACT_FROM_EMAIL;
    const to = process.env.FORUM_ALERT_EMAIL || process.env.CONTACT_TO_EMAIL;
    if (apiKey && from && to) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to: [to], subject: title,
          text: `${facts.map(([k, v]) => `${k}\n${v}`).join('\n\n')}\n\n${note}`,
          html: `${facts.map(([k, v]) => `<p><strong>${escapeHtml(k)}</strong><br>${escapeHtml(v)}</p>`).join('')}<p>${escapeHtml(note)}</p>`
        })
      }).catch(() => null);
      alerted = alerted || Boolean(res?.ok);
    }
  }

  const summary = { checked: results.length, not_opening: results.filter((r) => !r.ok).map((r) => r.name), newly_flagged: items.length, alerted, problems };
  console.log('org-safety-scan', JSON.stringify(summary));
  return response.status(200).json(summary);
}
