// Registers interest in a WHSF programme from its "Take part" panel. The database records it
// (public.whsf_programme_register: validation, safeguarding and per-email limits), then WHSF's learning team is
// emailed (WHSF's own Resend account), the person gets a confirmation with a reference, and Teams is alerted.

import { postToTeams } from './_teams.js';

const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
const PROGRAMMES = { digital_skills: 'Digital Skills', girls_in_ict: 'Girls in ICT', robotics_drones: 'Robotics & Drones', mil_lab: 'MIL Lab' };
const ROLES = { participant: 'Participant (18+)', parent_guardian: 'Parent or guardian', teacher_school: 'Teacher or school', partner_org: 'Partner organisation', volunteer_mentor: 'Volunteer or mentor' };

const recent = globalThis.__whsfProgrammeRequests || new Map();
globalThis.__whsfProgrammeRequests = recent;
const clean = (value, max) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function rateLimited(key) {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > 5;
}

async function sendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.ok;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed.' }); }

  const origin = clean(request.headers.origin, 300);
  const host = clean(request.headers.host, 200);
  if (origin) {
    try { if (new URL(origin).host !== host) return response.status(403).json({ error: 'Invalid request origin.' }); }
    catch { return response.status(403).json({ error: 'Invalid request origin.' }); }
  }

  const body = request.body || {};
  if (clean(body.website, 100)) return response.status(200).json({ message: 'Thank you. Your registration was received.' });
  const startedAt = Number(body.startedAt);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < 2500 || elapsed > 2 * 60 * 60 * 1000) {
    return response.status(400).json({ error: 'Please refresh the page and try again.' });
  }

  const data = {
    programme: clean(body.programme, 40),
    role: clean(body.role, 40),
    full_name: clean(body.fullName, 120),
    email: clean(body.email, 254).toLowerCase(),
    country: clean(body.country, 80),
    organisation: clean(body.organisation, 160),
    message: clean(body.message, 1000),
    adult_confirmed: body.adultConfirmed === true,
    consent: body.consent === true
  };
  if (!PROGRAMMES[data.programme] || !ROLES[data.role]) return response.status(400).json({ error: 'Choose the programme and how you are registering.' });
  if (data.full_name.length < 2 || data.country.length < 2) return response.status(400).json({ error: 'Enter your name and country.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return response.status(400).json({ error: 'Enter a valid email address.' });

  const forwarded = clean(request.headers['x-forwarded-for'], 200).split(',')[0].trim();
  if (rateLimited(forwarded || 'unknown')) return response.status(429).json({ error: 'Too many registrations were sent. Please wait ten minutes and try again.' });

  const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whsf_programme_register`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: data })
  });
  const result = await rpc.json().catch(() => null);
  if (!rpc.ok) return response.status(400).json({ error: (result && result.message) || 'Your registration could not be saved. Please try again.' });
  const reference = typeof result === 'string' ? result : 'WHSF';
  const programme = PROGRAMMES[data.programme];
  const role = ROLES[data.role];

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const team = process.env.LEARNING_EMAIL || process.env.CONTACT_TO_EMAIL;
  if (apiKey && from && team) {
    await sendEmail(apiKey, {
      from, to: [team], reply_to: data.email,
      subject: `[${reference}] Programme registration: ${programme} (${role})`,
      html: `<h1>New programme registration</h1><p><strong>Reference:</strong> ${reference}</p>` +
        `<p><strong>Programme:</strong> ${escapeHtml(programme)}<br><strong>Registering as:</strong> ${escapeHtml(role)}<br>` +
        `<strong>Name:</strong> ${escapeHtml(data.full_name)}<br><strong>Email:</strong> ${escapeHtml(data.email)}<br>` +
        `<strong>Country:</strong> ${escapeHtml(data.country)}<br><strong>Organisation:</strong> ${escapeHtml(data.organisation || 'Not given')}</p>` +
        (data.message ? `<p><strong>Message</strong><br>${escapeHtml(data.message).replace(/\n/g, '<br>')}</p>` : '') +
        `<p style="color:#666">Consent to be contacted: yes. ${data.role === 'participant' ? 'Confirmed 18 or over.' : ''}</p>`
    });
    await sendEmail(apiKey, {
      from, to: [data.email],
      subject: `You're registered for ${programme} [${reference}]`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2a0a17;max-width:560px">` +
        `<p>Hello ${escapeHtml(data.full_name.split(' ')[0])},</p>` +
        `<p>Thank you for registering your interest in the WHSF <strong>${escapeHtml(programme)}</strong> programme as ${escapeHtml(role.toLowerCase())}. Our learning team will contact you with the next intake, dates and how to take part.</p>` +
        `<p><strong>Your reference:</strong> ${reference}</p>` +
        `<p>While you wait, join the WHSF Forum (free, adults 18+) to meet mentors and other participants: <a href="https://www.worldhsfoundation.org/forum.html">worldhsfoundation.org/forum.html</a></p>` +
        `<p style="color:#7a6570;font-size:13px">WHSF programmes are free. WHSF never asks for fees, bank details or payment to take part. If you did not register, reply to this email.</p></div>`
    });
  }
  await postToTeams(`WHSF programme registration: ${programme}`, [
    ['Reference', reference], ['Registering as', role], ['Name', data.full_name], ['Country', data.country], ['Organisation', data.organisation || 'Not given']
  ], null, 'Full details are in the learning team inbox.');

  return response.status(200).json({ reference, message: `Thank you. You're registered for ${programme}. Your reference is ${reference}. Check your email for a confirmation.` });
}
