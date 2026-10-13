// Emails WHSF moderators when a Forum member submits an ID check (WHSF's own Resend account).
// The member's signed-in session is passed through to Supabase, which only releases one alert per
// pending check (public.forum_id_claim_alert), so this endpoint cannot be used to spam the inbox.
// The email never contains ID images or ID details: moderators review those on the Forum page.
// It also posts to WHSF's Microsoft Teams channel when TEAMS_ALERT_WEBHOOK_URL is set.

import { postToTeams, teamsConfigured } from './_teams.js';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const QUEUE_URL = 'https://www.worldhsfoundation.org/forum.html#idchecks';
const ID_TYPES = {
  national_id: 'National ID card',
  passport: 'Passport',
  drivers_licence: "Driver's licence",
  voter_card: "Voter's card",
  residence_permit: 'Residence permit'
};
const METHODS = {
  photo_selfie: 'Self-service (ID photo + photo selfie)',
  video_selfie: 'Self-service (ID photo + video selfie)',
  video_call: 'Video call requested (ID photo, then a live video call)'
};

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.FORUM_ALERT_EMAIL || process.env.CONTACT_TO_EMAIL;
  const emailReady = Boolean(apiKey && from && to);
  if (!emailReady && !teamsConfigured()) return response.status(503).json({ error: 'Alerts are not configured.' });

  // Claim the alert as the member (RLS + security-definer function decide whether one is due).
  const claim = await fetch(`${SUPABASE_URL}/rest/v1/rpc/forum_id_claim_alert`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}'
  });
  if (!claim.ok) return response.status(401).json({ error: 'Sign in first.' });
  const rows = await claim.json();
  const check = Array.isArray(rows) ? rows[0] : null;
  if (!check) return response.status(200).json({ sent: false });

  const name = escapeHtml(check.display_name || 'A member');
  const country = escapeHtml(check.country);
  const idType = escapeHtml(ID_TYPES[check.id_type] || check.id_type);
  const when = new Date(check.submitted_at || Date.now()).toUTCString();
  const method = METHODS[check.method] || METHODS.photo_selfie;

  const teams = await postToTeams('WHSF Forum: new member waiting for ID approval', [
    ['Member', check.display_name || 'A member'], ['Method', method], ['Country', check.country],
    ['ID type', ID_TYPES[check.id_type] || check.id_type], ['Submitted', when]
  ], { title: 'Review the ID check', url: QUEUE_URL }, 'ID and selfie images are only viewable on the Forum page and are deleted after your decision.');
  if (!emailReady) return response.status(200).json({ sent: teams });

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'WHSF Forum: new member waiting for ID approval',
      text: `${check.display_name || 'A member'} has submitted an ID check to join the WHSF Forum.\n\n` +
        `Method: ${method}\nCountry: ${check.country}\nID type: ${ID_TYPES[check.id_type] || check.id_type}\nSubmitted: ${when}\n\n` +
        `Review it (sign in with a WHSF admin or teacher account): ${QUEUE_URL}\n\n` +
        'The ID and selfie images are only viewable on the Forum page and are deleted after your decision.',
      html: `<p><strong>${name}</strong> has submitted an ID check to join the WHSF Forum.</p>` +
        `<p>Method: ${escapeHtml(method)}<br>Country: ${country}<br>ID type: ${idType}<br>Submitted: ${escapeHtml(when)}</p>` +
        `<p><a href="${QUEUE_URL}">Review the ID check</a> (sign in with a WHSF admin or teacher account).</p>` +
        '<p style="color:#666">The ID and selfie images are only viewable on the Forum page and are deleted after your decision.</p>'
    })
  });
  if (!emailResponse.ok && !teams) return response.status(502).json({ error: 'Email could not be sent.' });
  return response.status(200).json({ sent: true });
}
