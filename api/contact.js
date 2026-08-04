import { createHash, randomUUID } from 'node:crypto';

const recentRequests = globalThis.__whsfContactRequests || new Map();
globalThis.__whsfContactRequests = recentRequests;

const ROUTES = {
  Partnership: 'PARTNERSHIPS_EMAIL',
  'Donation / Sponsorship': 'DONATIONS_EMAIL',
  'Certificate help': 'LEARNING_EMAIL',
  'e-learning support': 'LEARNING_EMAIL',
  'School / Programme interest': 'LEARNING_EMAIL',
  'Fraud / Scam report': 'SAFEGUARDING_EMAIL'
};

function clean(value, maxLength) {
  return String(value || '').replace(/\0/g, '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function getClientKey(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return createHash('sha256').update(forwarded || 'unknown').digest('hex').slice(0, 20);
}

function isRateLimited(key) {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (recentRequests.get(key) || []).filter((time) => time > windowStart);
  recent.push(now);
  recentRequests.set(key, recent);
  return recent.length > 4;
}

async function sendEmail(apiKey, payload) {
  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!emailResponse.ok) {
    const detail = await emailResponse.text();
    throw new Error('Email provider rejected the request: ' + detail.slice(0, 300));
  }
  return emailResponse.json();
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const origin = clean(request.headers.origin, 300);
  const host = clean(request.headers.host, 200);
  if (origin) {
    try {
      if (new URL(origin).host !== host) return response.status(403).json({ error: 'Invalid request origin.' });
    } catch {
      return response.status(403).json({ error: 'Invalid request origin.' });
    }
  }

  const body = request.body || {};
  if (clean(body.website, 100)) {
    return response.status(200).json({ message: 'Thank you. Your enquiry was received.' });
  }

  const startedAt = Number(body.startedAt);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || elapsed < 2500 || elapsed > 2 * 60 * 60 * 1000) {
    return response.status(400).json({ error: 'Please refresh the page and try again.' });
  }

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 60);
  const interest = clean(body.interest, 100);
  const message = clean(body.message, 5000);
  const consent = body.consent === true;

  if (!firstName || !lastName || !interest || message.length < 10 || !consent) {
    return response.status(400).json({ error: 'Complete all required fields and confirm consent.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Enter a valid email address.' });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return response.status(429).json({ error: 'Too many enquiries were submitted. Please wait ten minutes and try again.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const fallbackRecipient = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !from || !fallbackRecipient) {
    return response.status(503).json({ error: 'The contact service is temporarily unavailable.' });
  }

  const routeVariable = ROUTES[interest];
  const recipient = (routeVariable && process.env[routeVariable]) || fallbackRecipient;
  const reference = 'WHSF-' + randomUUID().split('-')[0].toUpperCase();
  const submittedAt = new Date().toISOString();
  const safe = {
    name: escapeHtml(firstName + ' ' + lastName),
    email: escapeHtml(email),
    phone: escapeHtml(phone || 'Not provided'),
    interest: escapeHtml(interest),
    message: escapeHtml(message).replace(/\n/g, '<br>'),
    reference,
    submittedAt
  };

  await sendEmail(apiKey, {
    from,
    to: [recipient],
    reply_to: email,
    subject: '[' + reference + '] WHSF enquiry: ' + interest,
    html: '<h1>New WHSF website enquiry</h1>' +
      '<p><strong>Reference:</strong> ' + reference + '</p>' +
      '<p><strong>Name:</strong> ' + safe.name + '<br>' +
      '<strong>Email:</strong> ' + safe.email + '<br>' +
      '<strong>Phone:</strong> ' + safe.phone + '<br>' +
      '<strong>Route:</strong> ' + safe.interest + '</p>' +
      '<p><strong>Message</strong><br>' + safe.message + '</p>' +
      '<hr><p>Consent to use and retain this submission for follow-up: Yes<br>' +
      'Submitted: ' + submittedAt + '<br>Client record: ' + clientKey + '</p>'
  });

  await sendEmail(apiKey, {
    from,
    to: [email],
    subject: 'We received your WHSF enquiry [' + reference + ']',
    html: '<p>Hello ' + escapeHtml(firstName) + ',</p>' +
      '<p>Thank you for contacting World Humanitarian Support Foundation. Your enquiry has been routed to the appropriate team.</p>' +
      '<p><strong>Reference:</strong> ' + reference + '</p>' +
      '<p>We normally respond within three business days.</p>' +
      '<p>If you did not submit this enquiry, reply to this email and let us know.</p>'
  });

  return response.status(200).json({
    message: 'Thank you. Your enquiry was sent successfully. Acknowledgement reference: ' + reference + '. We normally respond within three business days.'
  });
}
