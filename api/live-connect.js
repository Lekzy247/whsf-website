const SUPABASE_URL = process.env.SUPABASE_URL || "https://ophymlgqnfilgxsuzcuz.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh";
const SUPPORT_EMAIL = "info@worldhsfoundation.org";
const ADMIN_LOGIN_URL = "https://www.worldhsfoundation.org/ai-career-connect/live-connect-admin.html";

const clean = (value, max = 200) => String(value || "").trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeHTML = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);

const callRpc = async (name, body, accessToken = SUPABASE_ANON_KEY) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } finally {
    clearTimeout(timer);
  }
};

const buildApprovalEmail = (data, result) => {
  const requestId = result.requestId || result.request_id || "pending";
  const approvalUrl = `https://www.worldhsfoundation.org/ai-career-connect/live-connect-admin.html?request=${encodeURIComponent(requestId)}&approve=1`;
  const subject = `Live Connect approval request — ${clean(data.connectionType, 60)} — ${requestId}`;
  const body = [
    "A new WHSF Live Connect request is awaiting admin review.", "",
    `Request ID: ${requestId}`,
    `Requester: ${clean(data.fullName, 100)}`,
    `Email: ${clean(data.email, 160)}`,
    `Role: ${clean(data.role, 40)}`,
    `Organisation: ${clean(data.organisation, 140) || "Not provided"}`,
    `Country: ${clean(data.country, 80)}`,
    `Connection type: ${clean(data.connectionType, 60)}`,
    `Preferred platform: ${clean(data.deliveryMode, 40)}`,
    `Preferred date/time: ${clean(data.preferredDate, 10)} ${clean(data.preferredTime, 5)} ${clean(data.timezone, 80)}`,
    `Topic: ${clean(data.topic, 180)}`,
    `Notes: ${clean(data.notes, 1200) || "None"}`, "",
    `Approve securely: ${approvalUrl}`,
    "Sign in as info@worldhsfoundation.org. The request will move into the approved scheduling queue."
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f3f7fb;font-family:Arial,sans-serif;color:#071a35"><div style="max-width:640px;margin:0 auto;padding:32px 18px"><div style="padding:28px;border-radius:18px;background:#fff;border:1px solid #dbe4ed"><p style="margin:0 0 8px;color:#1b8b73;font-size:12px;font-weight:700;text-transform:uppercase">WHSF Live Connect</p><h1 style="margin:0 0 16px;font-size:25px">New request awaiting approval</h1><p style="line-height:1.6"><strong>${escapeHTML(clean(data.fullName, 100))}</strong> requested a ${escapeHTML(clean(data.connectionType, 60))} session about ${escapeHTML(clean(data.topic, 180))}.</p><p style="line-height:1.6"><strong>Preferred:</strong> ${escapeHTML(clean(data.preferredDate, 10))} ${escapeHTML(clean(data.preferredTime, 5))} ${escapeHTML(clean(data.timezone, 80))}<br><strong>Platform:</strong> ${escapeHTML(clean(data.deliveryMode, 40))}<br><strong>Request ID:</strong> ${escapeHTML(requestId)}</p><a href="${escapeHTML(approvalUrl)}" style="display:inline-block;margin:12px 0;padding:14px 20px;border-radius:10px;background:#1b8b73;color:#fff;text-decoration:none;font-weight:700">Approve and open scheduling →</a><p style="color:#587087;font-size:13px;line-height:1.6">For security, sign in with <strong>info@worldhsfoundation.org</strong>. Approval does not expose a meeting link publicly; complete the Google Meet schedule in the admin workspace.</p></div></div></body></html>`;
  return { requestId, subject, body, html, replyTo: clean(data.email, 160), mailto: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
};

const sendApprovalEmail = async (email) => {
  if (!process.env.RESEND_API_KEY) return { delivered: false, reason: "provider-not-configured" };
  const upstream = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.LIVE_CONNECT_FROM_EMAIL || "WHSF Live Connect <notifications@worldhsfoundation.org>",
      to: [SUPPORT_EMAIL],
      reply_to: email.replyTo,
      subject: email.subject,
      text: email.body,
      html: email.html
    })
  });
  return { delivered: upstream.ok, reason: upstream.ok ? "sent" : `provider-${upstream.status}` };
};

const sendAdminLoginEmail = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(ADMIN_LOGIN_URL)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: SUPPORT_EMAIL, create_user: true })
    });
  } finally { clearTimeout(timer); }
};

const serviceUnavailable = (response) => response.status(503).json({
  error: "Live Connect is being configured. Please try again shortly or contact WHSF directly.",
  supportEmail: SUPPORT_EMAIL,
  setupRequired: true
});

module.exports = async (request, response) => {
  if (request.method === "GET") {
    const sessionId = clean(request.query?.session, 40);
    if (sessionId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId)) {
        return response.status(400).json({ error: "Choose a valid Live Connect session." });
      }
      const token = String(request.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return response.status(401).json({ error: "Sign in to access this live session." });
      try {
        const upstream = await callRpc("ai_career_authenticated_live_session", { p_session_id: sessionId }, token);
        if (upstream.status === 401 || upstream.status === 403) return response.status(401).json({ error: "Your session has expired. Sign in again." });
        if (!upstream.ok) return response.status(404).json({ error: "This session is unavailable or has not been approved." });
        const sessions = await upstream.json();
        const liveSession = Array.isArray(sessions) ? sessions[0] : sessions;
        if (!liveSession) return response.status(404).json({ error: "This approved session is not available." });
        response.setHeader("Cache-Control", "no-store");
        return response.status(200).json({ session: liveSession });
      } catch (error) {
        console.error("Authenticated Live Connect lookup failed", { message: error.message });
        return response.status(502).json({ error: "The live room could not be opened. Please try again." });
      }
    }

    const from = new Date(String(request.query?.from || ""));
    const to = new Date(String(request.query?.to || ""));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return response.status(400).json({ error: "Choose a valid calendar period." });
    }
    try {
      const upstream = await callRpc("ai_career_public_live_sessions", {
        p_from: from.toISOString(),
        p_to: to.toISOString()
      });
      if (!upstream.ok) return serviceUnavailable(response);
      const sessions = await upstream.json();
      response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=180");
      return response.status(200).json({ sessions, fetchedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Live Connect calendar failed", { message: error.message });
      return serviceUnavailable(response);
    }
  }

  if (request.method === "POST") {
    const data = request.body || {};
    if (data.action === "admin_login") {
      try {
        const loginEmail = await sendAdminLoginEmail();
        if (!loginEmail.ok) return response.status(loginEmail.status === 429 ? 429 : 502).json({ error: loginEmail.status === 429 ? "Please wait before requesting another admin login email." : "The secure admin email could not be sent." });
        response.setHeader("Cache-Control", "no-store");
        return response.status(202).json({ ok: true, message: `Secure login sent to ${SUPPORT_EMAIL}.` });
      } catch (error) {
        console.error("Live Connect admin login email failed", { message: error.message });
        return response.status(504).json({ error: "The secure admin email service timed out. Please try again." });
      }
    }
    const fullName = clean(data.fullName, 100);
    const email = clean(data.email, 160).toLowerCase();
    const preferredStart = new Date(`${clean(data.preferredDate, 10)}T${clean(data.preferredTime, 5)}:00`);
    if (!fullName || !emailPattern.test(email) || !data.role || !data.connectionType || !data.topic || !data.country || Number.isNaN(preferredStart.getTime())) {
      return response.status(400).json({ error: "Complete all required fields with a valid email and preferred date." });
    }
    if (preferredStart.getTime() < Date.now() + 60 * 60 * 1000) {
      return response.status(400).json({ error: "Choose a preferred time that is still in the future." });
    }
    try {
      const upstream = await callRpc("ai_career_submit_live_connect_request", {
        p_requester_name: fullName,
        p_email: email,
        p_requester_role: clean(data.role, 40),
        p_organisation: clean(data.organisation, 140),
        p_country: clean(data.country, 80),
        p_connection_type: clean(data.connectionType, 60),
        p_topic: clean(data.topic, 180),
        p_preferred_start: preferredStart.toISOString(),
        p_timezone: clean(data.timezone, 80),
        p_delivery_mode: clean(data.deliveryMode, 40),
        p_notes: clean(data.notes, 1200),
        p_website: clean(data.website, 120)
      });
      if (!upstream.ok) return serviceUnavailable(response);
      const result = await upstream.json();
      const approvalEmail = buildApprovalEmail(data, result);
      let emailNotification = { delivered: false, reason: "provider-not-configured" };
      try { emailNotification = await sendApprovalEmail(approvalEmail); }
      catch (error) { console.error("Live Connect approval email failed", { message: error.message }); }
      response.setHeader("Cache-Control", "no-store");
      return response.status(202).json({
        ...result,
        requestId: approvalEmail.requestId,
        approvalEmail: SUPPORT_EMAIL,
        approvalMailto: approvalEmail.mailto,
        emailDelivered: emailNotification.delivered,
        message: emailNotification.delivered
          ? "Request received and WHSF has been notified by email."
          : "Request saved. Send the prepared approval email to notify WHSF immediately."
      });
    } catch (error) {
      console.error("Live Connect request failed", { message: error.message });
      return serviceUnavailable(response);
    }
  }

  response.setHeader("Allow", "GET, POST");
  return response.status(405).json({ error: "Method not allowed." });
};
