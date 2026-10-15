// One-click unsubscribe from "WHSF posted" emails (link + List-Unsubscribe header in api/official-post-email.js).
// GET shows a confirmation page; POST (mail apps' one-click, or the button on that page) turns the emails off through
// forum_email_optout. The link carries an HMAC of the member id, so it cannot be used for anyone else.

import { timingSafeEqual } from 'node:crypto';
import { unsubscribeToken } from './official-post-email.js';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';

const page = (title, text, form = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title} | WHSF</title></head>
<body style="font-family:Arial,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#2a0a17;line-height:1.5">
<h1 style="font-size:22px">${title}</h1><p>${text}</p>${form}
<p><a href="https://www.worldhsfoundation.org/forum.html" style="color:#7b2142">Go to the WHSF Forum</a></p></body></html>`;

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const secret = process.env.JOBS_INGEST_SECRET;
  const q = request.query || {};
  const u = String(q.u || ''); const t = String(q.t || '');
  const valid = secret && /^[0-9a-f-]{36}$/.test(u) && /^[0-9a-f]{32}$/.test(t)
    && timingSafeEqual(Buffer.from(t), Buffer.from(unsubscribeToken(secret, u)));
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!valid) return response.status(400).send(page('Link not valid', 'This unsubscribe link is not complete. Please use the link from the email again.'));

  if (request.method === 'POST') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/forum_email_optout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p_user: u })
    });
    if (!res.ok) return response.status(502).send(page('Please try again', 'We could not update your email settings just now.'));
    return response.status(200).send(page('You are unsubscribed', 'You will no longer get emails when WHSF posts on the Forum. You still see these updates under Alerts in the Forum.'));
  }
  return response.status(200).send(page('Stop "WHSF posted" emails?', 'You will still see WHSF updates under Alerts when you visit the Forum.',
    `<form method="post"><button type="submit" style="padding:10px 18px;border:0;border-radius:8px;background:#7b2142;color:#fff;font-weight:bold;cursor:pointer">Yes, stop these emails</button></form>`));
}
