const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const clean = (value, max = 2000) => String(value || '').trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { ok: false, message: 'Method not allowed.' });
  }

  const body = request.body || {};
  if (clean(body.website, 100)) return json(response, 200, { ok: true });

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 180).toLowerCase();
  const phone = clean(body.phone, 80);
  const interest = clean(body.interest, 120);
  const message = clean(body.message, 5000);
  const consent = clean(body.consent, 10) === 'yes';

  if (!firstName || !lastName || !emailPattern.test(email) || !interest || message.length < 10 || !consent) {
    return json(response, 400, { ok: false, message: 'Please complete all required fields and confirm consent.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || 'info@worldhsfoundation.org';
  if (!apiKey) return json(response, 503, { ok: false, message: 'Online enquiries are temporarily unavailable. Please email info@worldhsfoundation.org.' });

  const submittedAt = new Date().toISOString();
  const text = [
    `WHSF website enquiry: ${interest}`,
    '',
    `Name: ${firstName} ${lastName}`,
    `Email: ${email}`,
    `Phone / WhatsApp: ${phone || 'Not provided'}`,
    `Interest: ${interest}`,
    `Consent recorded: ${consent ? 'Yes' : 'No'}`,
    `Submitted: ${submittedAt}`,
    '',
    'Message:',
    message
  ].join('\n');

  const send = (payload) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const from = process.env.CONTACT_FROM_EMAIL || 'WHSF Website <website@worldhsfoundation.org>';
  const delivery = await send({ from, to: [toEmail], reply_to: email, subject: `Website enquiry: ${interest}`, text });
  if (!delivery.ok) return json(response, 502, { ok: false, message: 'Your enquiry could not be delivered. Please email info@worldhsfoundation.org.' });

  await send({
    from,
    to: [email],
    reply_to: toEmail,
    subject: 'WHSF has received your enquiry',
    text: `Hello ${firstName},\n\nThank you for contacting World Humanitarian Support Foundation. We received your ${interest.toLowerCase()} enquiry and normally respond within three business days.\n\nIf your message concerns immediate danger or an emergency, contact the appropriate local emergency service.\n\nWHSF team`
  });

  return json(response, 200, { ok: true, message: 'Thank you. Your enquiry has been sent. Please check your email for an acknowledgement.' });
}
