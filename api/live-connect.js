const SUPABASE_URL = process.env.SUPABASE_URL || "https://ophymlgqnfilgxsuzcuz.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh";
const SUPPORT_EMAIL = "info@worldhsfoundation.org";

const clean = (value, max = 200) => String(value || "").trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    `Review securely: https://www.worldhsfoundation.org/ai-career-connect/live-connect-admin.html?request=${encodeURIComponent(requestId)}`
  ].join("\n");
  return { requestId, subject, body, replyTo: clean(data.email, 160), mailto: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
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
      text: email.body
    })
  });
  return { delivered: upstream.ok, reason: upstream.ok ? "sent" : `provider-${upstream.status}` };
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
