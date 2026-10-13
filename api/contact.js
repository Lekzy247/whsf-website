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

const VERIFY_STAFF_URL = 'https://www.worldhsfoundation.org/verify-certificate.html#staff-verification';
const CONTACT_URL = 'https://www.worldhsfoundation.org/contact.html';

// Messages about money WHSF supposedly pays out, promotions, prizes or scams get a fraud advisory
// as their acknowledgement instead of the standard one.
const FRAUD_PATTERN = new RegExp([
  'scam', 'fraud', 'fake', 'impersonat', 'identity theft', 'hack',
  'disburs', 'payout', 'pay out', 'loan', 'lottery', 'prize', 'winner', 'jackpot',
  'promotion', '\bpromo\b', 'cash (grant|gift|support|reward)', 'empowerment (fund|grant|money|cash|program)',
  '(registration|processing|activation|clearance|release) fee', 'beneficiar', 'palliative',
  'claim (my|the|your) (grant|fund|money|prize|reward)', '(grant|fund|money) (approved|awarded|release)',
  'whatsapp group', 'bank (details|account)', 'account number', 'investment opportunit'
].join('|'), 'i');

// The fraud advisory goes only to personal/public mailboxes (Gmail, Yahoo, Outlook, iCloud, ...), the same
// rule as the Gmail auto-reply (docs/automation/gmail-fraud-autoreply.gs). Business, corporate and other
// private-domain senders are treated as a normal enquiry: no fraud flag and the normal acknowledgement.
const PERSONAL_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'ymail.com', 'rocketmail.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'mail.com', 'zoho.com', 'zohomail.com', 'fastmail.com', 'yandex.com', 'yandex.ru', 'mail.ru', 'qq.com', '163.com', '126.com', 'tutanota.com', 'tuta.io'
]);
function isPersonalEmail(address) {
  const domain = String(address || '').split('@').pop().trim().toLowerCase();
  return PERSONAL_MAIL_DOMAINS.has(domain) ||
    /^(yahoo|outlook|hotmail|live)\.(com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/.test(domain) ||
    /^gmx\.(com|net|[a-z]{2})$/.test(domain);
}

function isFraudRelated(interest, message) {
  return interest === 'Fraud / Scam report' || FRAUD_PATTERN.test(message);
}

function fraudAdvisory(firstName, reference) {
  const button = 'display:inline-block;padding:12px 20px;border-radius:10px;background:#7b2142;color:#ffffff;font-weight:600;text-decoration:none';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#160d1d;max-width:600px">' +
    '<p>Hello ' + escapeHtml(firstName) + ',</p>' +
    '<p>Thank you for contacting World Humanitarian Support Foundation (WHSF). Your message has been received.</p>' +
    '<p><strong>Important:</strong> WHSF is <strong>not involved</strong> in disbursing funds, cash grants, loans or empowerment payments to individuals, and does not run promotions, prizes or "opportunity" payouts. WHSF never asks anyone to pay a fee or share bank details to receive any benefit. Any message, page or group claiming otherwise is not from WHSF.</p>' +
    '<p>If someone has contacted you about this, please <strong>do not send money or personal or financial information</strong>, and report it to the police or the appropriate authority (for example, a cybercrime or consumer-protection unit) close to you.</p>' +
    '<p>To protect yourself from fraud, identity theft or misrepresentation, verify anyone who says they work for WHSF. Check their <strong>name, phone number and official WHSF email</strong>:</p>' +
    '<p><a href="' + VERIFY_STAFF_URL + '" style="' + button + '">Verify a WHSF employee</a></p>' +
    '<p style="font-size:13px;color:#5b4d55">Or open this link: <a href="' + VERIFY_STAFF_URL + '">' + VERIFY_STAFF_URL + '</a></p>' +
    '<p>Official WHSF contacts: <a href="https://www.worldhsfoundation.org">www.worldhsfoundation.org</a> and <a href="mailto:info@worldhsfoundation.org">info@worldhsfoundation.org</a>. To report suspected fraud to us, use <a href="' + CONTACT_URL + '">our Contact page</a>.</p>' +
    '<p><strong>Reference:</strong> ' + reference + '</p>' +
    '<p>World Humanitarian Support Foundation</p>' +
    '</div>';
  const text =
    'Hello ' + firstName + ',\n\n' +
    'Thank you for contacting World Humanitarian Support Foundation (WHSF). Your message has been received.\n\n' +
    'Important: WHSF is not involved in disbursing funds, cash grants, loans or empowerment payments to individuals, and does not run promotions, prizes or "opportunity" payouts. WHSF never asks anyone to pay a fee or share bank details to receive any benefit. Any message, page or group claiming otherwise is not from WHSF.\n\n' +
    'If someone has contacted you about this, do not send money or personal or financial information, and report it to the police or the appropriate authority (for example, a cybercrime or consumer-protection unit) close to you.\n\n' +
    'Verify anyone who says they work for WHSF by name, phone number and official WHSF email:\n' + VERIFY_STAFF_URL + '\n\n' +
    'Official WHSF contacts: www.worldhsfoundation.org and info@worldhsfoundation.org.\n\n' +
    'Reference: ' + reference + '\n\nWorld Humanitarian Support Foundation';
  return { html, text };
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

  const fraudRelated = isPersonalEmail(email) && isFraudRelated(interest, message);
  const routeVariable = ROUTES[fraudRelated ? 'Fraud / Scam report' : interest];
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
    subject: '[' + reference + '] ' + (fraudRelated ? 'FRAUD ALERT - ' : '') + 'WHSF enquiry: ' + interest,
    html: '<h1>New WHSF website enquiry</h1>' +
      '<p><strong>Reference:</strong> ' + reference + '</p>' +
      '<p><strong>Name:</strong> ' + safe.name + '<br>' +
      '<strong>Email:</strong> ' + safe.email + '<br>' +
      '<strong>Phone:</strong> ' + safe.phone + '<br>' +
      '<strong>Route:</strong> ' + safe.interest + '</p>' +
      (fraudRelated ? '<p><strong>Flagged as fraud-related.</strong> The sender was sent the fraud advisory with the Verify a WHSF employee link.</p>' : '') +
      '<p><strong>Message</strong><br>' + safe.message + '</p>' +
      '<hr><p>Consent to use and retain this submission for follow-up: Yes<br>' +
      'Submitted: ' + submittedAt + '<br>Client record: ' + clientKey + '</p>'
  });

  if (fraudRelated) {
    const advisory = fraudAdvisory(firstName, reference);
    await sendEmail(apiKey, {
      from,
      to: [email],
      subject: 'Important: WHSF does not disburse funds or run promotions [' + reference + ']',
      html: advisory.html,
      text: advisory.text
    });
  } else {
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
  }

  return response.status(200).json({
    message: 'Thank you. Your enquiry was sent successfully. Acknowledgement reference: ' + reference + '. We normally respond within three business days.'
  });
}
