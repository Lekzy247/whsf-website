// Emails Forum members when an official WHSF account posts (owner request 2026-10-15).
// Called by the database (trigger forum_posts_official_alert, via pg_net) with the header X-WHSF-Secret, whose value is
// kept in Supabase Vault ('whsf_official_alert_secret') and in Vercel as OFFICIAL_ALERT_SECRET. The post and the
// recipients come from forum_official_post_mail (checked with JOBS_INGEST_SECRET), which returns them only once per
// post, so a retried call never emails twice. Members who unsubscribed (email_official_updates = false) are skipped.
// Sent with WHSF's own Resend account (never Gelllez's). Every email has a one-click unsubscribe link.

import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const SITE = 'https://www.worldhsfoundation.org';

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Forum formatting markers (**bold**, __underline__, {c:x}{/c}, {f:x}{/f}) are removed for email.
const plain = (t) => String(t ?? '').replace(/\*\*|__|\{\/?[cf](:[a-z0-9_-]+)?\}/g, '').replace(/[ \t]+/g, ' ').trim();
const same = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export const unsubscribeToken = (secret, userId) => createHmac('sha256', `${secret}:unsubscribe`).update(String(userId)).digest('hex').slice(0, 32);

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

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed.' }); }
  const alertSecret = process.env.OFFICIAL_ALERT_SECRET;
  const syncSecret = process.env.JOBS_INGEST_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!alertSecret || !syncSecret || !apiKey || !from) return response.status(503).json({ error: 'Not configured.' });
  if (!same(request.headers['x-whsf-secret'] || '', alertSecret)) return response.status(401).json({ error: 'Not allowed.' });
  const postId = String(request.body?.post_id || '');
  if (!/^[0-9a-f-]{36}$/.test(postId)) return response.status(400).json({ error: 'Invalid request.' });

  let rows;
  try { rows = await rpc('forum_official_post_mail', { p_secret: syncSecret, p_post: postId }); }
  catch (err) { console.error('official-post-email', err.message); return response.status(502).json({ error: 'Could not read the post.' }); }
  if (!Array.isArray(rows) || !rows.length) return response.status(200).json({ sent: 0 }); // already sent, hidden, or nobody to tell

  const author = rows[0].author_name || 'WHSF';
  const body = plain(rows[0].body);
  const firstLine = body.split('\n').find((l) => l.trim()) || 'A new update from WHSF';
  const subject = `${author}: ${firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine}`;
  const preview = body.length > 900 ? `${body.slice(0, 897)}…` : body;
  const postUrl = `${SITE}/forum.html#post/${postId}`;
  const image = typeof rows[0].image_url === 'string' && rows[0].image_url.startsWith('https://') ? rows[0].image_url : null;

  const emails = rows.filter((r) => typeof r.email === 'string' && r.email.includes('@')).map((r) => {
    const unsub = `${SITE}/api/email-unsubscribe?u=${r.user_id}&t=${unsubscribeToken(syncSecret, r.user_id)}`;
    return {
      from, to: [r.email], subject,
      headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      text: `Hello ${r.display_name || 'there'},\n\n${author} posted on the WHSF Forum:\n\n${preview}\n\nRead it and reply: ${postUrl}\n\n` +
        `WHSF never asks for money, bank details or passwords by email or chat.\nStop these emails: ${unsub}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#2a0a17;line-height:1.5">
<p>Hello ${escapeHtml(r.display_name || 'there')},</p>
<p><strong>${escapeHtml(author)}</strong> posted on the WHSF Forum:</p>
<div style="padding:14px 16px;border-left:4px solid #7b2142;background:#fbf5f7;white-space:pre-line">${escapeHtml(preview)}</div>
${image ? `<p><img src="${escapeHtml(image)}" alt="" style="max-width:100%;border-radius:10px"></p>` : ''}
<p><a href="${postUrl}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#7b2142;color:#fff;text-decoration:none;font-weight:bold">Read it on the Forum</a></p>
<p style="font-size:12px;color:#7a6570">WHSF never asks for money, bank details or passwords by email or chat.<br>
You get this because you are a WHSF Forum member. <a href="${unsub}" style="color:#7a6570">Stop these emails</a>.</p></div>`
    };
  });

  let sent = 0;
  for (let i = 0; i < emails.length; i += 100) {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emails.slice(i, i + 100))
    });
    if (res.ok) sent += Math.min(100, emails.length - i);
    else console.error('official-post-email resend', res.status, (await res.text()).slice(0, 300));
  }
  await rpc('forum_official_mail_sent', { p_secret: syncSecret, p_post: postId, p_count: sent }).catch(() => {});
  return response.status(200).json({ sent });
}
