// Supabase "Send Email" auth hook: Supabase hands every sign-in email (sign-in code, password reset, email
// confirmation, invite, email change) to this endpoint, which sends it through WHSF's own Resend account over
// the fast Resend web API instead of SMTP (SMTP from Supabase to Resend kept timing out after 10 seconds).
// Requests are signed by Supabase (Standard Webhooks); SEND_EMAIL_HOOK_SECRET is the secret shown in
// Supabase > Authentication > Hooks. Nothing is stored here.

import crypto from 'node:crypto';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SITE = 'https://www.worldhsfoundation.org';
const ALLOWED_REDIRECT = /^https:\/\/(www\.)?worldhsfoundation\.org(\/|$)/;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function rawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  return typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
}

// Standard Webhooks signature check (what Supabase uses for auth hooks).
function verify(body, headers, secret) {
  const id = String(headers['webhook-id'] || '');
  const timestamp = String(headers['webhook-timestamp'] || '');
  const signatures = String(headers['webhook-signature'] || '');
  if (!id || !/^\d+$/.test(timestamp) || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return signatures.split(' ').some((part) => {
    const sig = part.split(',')[1] || '';
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

function verifyLink(tokenHash, type, redirectTo) {
  const redirect = ALLOWED_REDIRECT.test(String(redirectTo || '')) ? redirectTo : `${SITE}/forum.html`;
  return `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(redirect)}`;
}

function layout(title, intro, code, button, outro) {
  const html = `<!doctype html><html><body style="margin:0;background:#f7f1f4;font-family:Arial,Helvetica,sans-serif;color:#2a0a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1f4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#7b2142;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold">World Humanitarian Support Foundation</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 12px;font-size:22px;color:#2a0a17">${escapeHtml(title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#4b3a43">${escapeHtml(intro)}</p>
${code ? `<p style="margin:0 0 6px;font-size:13px;color:#7a6570;text-transform:uppercase;letter-spacing:1px">Your code</p>
<p style="margin:0 0 18px;font-size:32px;font-weight:bold;letter-spacing:8px;font-family:Consolas,Menlo,monospace;color:#2a0a17">${escapeHtml(code)}</p>` : ''}
${button ? `<p style="margin:0 0 18px"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#7b2142;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escapeHtml(button.label)}</a></p>` : ''}
<p style="margin:0;font-size:13px;line-height:1.5;color:#7a6570">${escapeHtml(outro)}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#fbf7f9;font-size:12px;color:#7a6570">WHSF will never ask for your password or payment by email. Questions: info@worldhsfoundation.org</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, '', intro, code ? `\nYour code: ${code}` : '', button ? `\n${button.label}: ${button.url}` : '', '', outro,
    '', 'WHSF will never ask for your password or payment by email. Questions: info@worldhsfoundation.org'].join('\n');
  return { html, text };
}

function buildEmails(user, data) {
  const type = data.email_action_type;
  const notYou = "If you didn't ask for this, you can ignore this email. Your account stays safe.";
  switch (type) {
    case 'magiclink':
      return [{ to: user.email, subject: `${data.token} is your WHSF sign-in code`, ...layout('Confirm it\'s you',
        'Enter this code on the WHSF Forum to finish signing in. It works once and expires soon.', data.token,
        { label: 'Or sign in on this device', url: verifyLink(data.token_hash, 'magiclink', data.redirect_to) }, notYou) }];
    case 'recovery':
      return [{ to: user.email, subject: 'Reset your WHSF password', ...layout('Reset your password',
        'Press the button to choose a new password for your WHSF account. The link works once and expires soon.', null,
        { label: 'Choose a new password', url: verifyLink(data.token_hash, 'recovery', data.redirect_to) }, notYou) }];
    case 'signup':
      return [{ to: user.email, subject: 'Confirm your email for WHSF', ...layout('Confirm your email',
        'Welcome to WHSF. Press the button to confirm your email address.', data.token,
        { label: 'Confirm my email', url: verifyLink(data.token_hash, 'signup', data.redirect_to) }, notYou) }];
    case 'invite':
      return [{ to: user.email, subject: 'You are invited to WHSF', ...layout('You are invited',
        'You have been invited to create a WHSF account. Press the button to accept.', null,
        { label: 'Accept the invitation', url: verifyLink(data.token_hash, 'invite', data.redirect_to) }, notYou) }];
    case 'reauthentication':
      return [{ to: user.email, subject: `${data.token} is your WHSF confirmation code`, ...layout('Confirm it\'s you',
        'Enter this code to confirm the change to your WHSF account.', data.token, null, notYou) }];
    case 'email_change': {
      // Supabase: token_hash_new goes to the current address, token_hash to the new address.
      const out = [];
      if (user.email && data.token_hash_new) out.push({ to: user.email, subject: 'Confirm your new WHSF email', ...layout('Confirm your email change',
        `Press the button to confirm changing your WHSF email to ${user.new_email}.`, null,
        { label: 'Confirm the change', url: verifyLink(data.token_hash_new, 'email_change', data.redirect_to) }, notYou) });
      if (user.new_email && data.token_hash) out.push({ to: user.new_email, subject: 'Confirm your new WHSF email', ...layout('Confirm your new email',
        'Press the button to confirm this is your new email address for WHSF.', null,
        { label: 'Confirm this email', url: verifyLink(data.token_hash, 'email_change', data.redirect_to) }, notYou) });
      return out;
    }
    default:
      return [];
  }
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const fail = (status, message) => response.status(status).json({ error: { http_code: status, message } });
  if (request.method !== 'POST') return fail(405, 'Method not allowed.');

  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL || 'WHSF <noreply@worldhsfoundation.org>';
  if (!secret || !apiKey) return fail(500, 'Email sending is not configured.');

  const body = await rawBody(request);
  if (!verify(body, request.headers, secret)) return fail(401, 'Invalid signature.');

  let payload;
  try { payload = JSON.parse(body); } catch { return fail(400, 'Invalid request.'); }
  const user = payload?.user || {};
  const data = payload?.email_data || {};
  const emails = buildEmails(user, data);
  if (!emails.length) return fail(400, `Unsupported email type: ${data.email_action_type || 'unknown'}`);

  for (const email of emails) {
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text })
    });
    if (!sent.ok) return fail(502, 'The email could not be sent. Please try again.');
  }
  return response.status(200).json({});
}
