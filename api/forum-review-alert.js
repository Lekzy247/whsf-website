// Tells WHSF moderators (Microsoft Teams channel and/or email) that a new Forum event or advert is
// waiting for approval. The member's signed-in session is passed through to Supabase, which only
// releases one alert per pending item the member owns (public.forum_review_claim_alert).

import { postToTeams, teamsConfigured } from './_teams.js';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const SITE = 'https://www.worldhsfoundation.org/forum.html';
const LABEL = { event: 'event', advert: 'advert', org: 'organisation (verification)' };

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const origin = String(request.headers.origin || '');
  const host = String(request.headers.host || '');
  if (origin) {
    try {
      if (new URL(origin).host !== host) return response.status(403).json({ error: 'Invalid request origin.' });
    } catch {
      return response.status(403).json({ error: 'Invalid request origin.' });
    }
  }
  const auth = String(request.headers.authorization || '');
  if (!/^Bearer [\w.-]{20,4000}$/.test(auth)) return response.status(401).json({ error: 'Sign in first.' });

  let input = request.body;
  if (typeof input === 'string') { try { input = JSON.parse(input); } catch { input = null; } }
  const kind = input?.kind;
  const id = String(input?.id || '');
  if (!LABEL[kind] || !/^[0-9a-f-]{36}$/.test(id)) return response.status(400).json({ error: 'Invalid request.' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.FORUM_ALERT_EMAIL || process.env.CONTACT_TO_EMAIL;
  const emailReady = Boolean(apiKey && from && to);
  if (!emailReady && !teamsConfigured()) return response.status(503).json({ error: 'Alerts are not configured.' });

  const claim = await fetch(`${SUPABASE_URL}/rest/v1/rpc/forum_review_claim_alert`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_kind: kind, p_id: id })
  });
  if (!claim.ok) return response.status(401).json({ error: 'Sign in first.' });
  const rows = await claim.json();
  const item = Array.isArray(rows) ? rows[0] : null;
  if (!item) return response.status(200).json({ sent: false });

  const link = kind === 'event' ? `${SITE}#events/${id}` : kind === 'org' ? `${SITE}#admin/orgs` : `${SITE}#ads`;
  const title = `WHSF Forum: new ${LABEL[kind]} waiting for approval`;
  const facts = [
    [kind === 'event' ? 'Event' : kind === 'org' ? 'Organisation' : 'Advert', item.title],
    ['Submitted by', item.member_name],
    [kind === 'event' ? 'Type and time' : kind === 'org' ? 'Website and country' : 'Links to', item.detail]
  ];
  const teams = await postToTeams(title, facts, { title: 'Review it', url: link }, 'Sign in with a WHSF admin or teacher account to approve or reject.');
  let email = false;
  if (emailReady) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject: title,
        text: facts.map(([k, v]) => `${k}: ${v || ''}`).join('\n') + `\n\nReview it (sign in with a WHSF admin or teacher account): ${link}`,
        html: facts.map(([k, v]) => `<strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}`).join('<br>') +
          `<p><a href="${link}">Review it</a> (sign in with a WHSF admin or teacher account).</p>`
      })
    });
    email = res.ok;
  }
  return response.status(200).json({ sent: teams || email });
}
