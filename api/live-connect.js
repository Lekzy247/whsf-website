const SUPABASE_URL = process.env.SUPABASE_URL || "https://ophymlgqnfilgxsuzcuz.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh";
const SUPPORT_EMAIL = "info@worldhsfoundation.org";

const clean = (value, max = 200) => String(value || "").trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const callRpc = async (name, body) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } finally {
    clearTimeout(timer);
  }
};

const serviceUnavailable = (response) => response.status(503).json({
  error: "Live Connect is being configured. Please try again shortly or contact WHSF directly.",
  supportEmail: SUPPORT_EMAIL,
  setupRequired: true
});

module.exports = async (request, response) => {
  if (request.method === "GET") {
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
      response.setHeader("Cache-Control", "no-store");
      return response.status(202).json(result);
    } catch (error) {
      console.error("Live Connect request failed", { message: error.message });
      return serviceUnavailable(response);
    }
  }

  response.setHeader("Allow", "GET, POST");
  return response.status(405).json({ error: "Method not allowed." });
};
