(() => {
  const SUPABASE_URL = "https://ophymlgqnfilgxsuzcuz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh";
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  const loginForm = document.querySelector("#admin-login-form");
  const scheduleForm = document.querySelector("#schedule-form");
  const loginStatus = document.querySelector("#admin-login-status");
  const requestStatus = document.querySelector("#request-status");
  const scheduleStatus = document.querySelector("#schedule-status");
  const requestSelect = scheduleForm.elements.requestId;
  const requests = new Map();
  let adminUser;

  const setStatus = (element, message, kind = "") => { element.textContent = message; element.className = `portal-status${kind ? ` ${kind}` : ""}`; };
  const selectedRequest = () => requests.get(requestSelect.value);
  const openEmail = (to, subject, body) => { location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };

  const renderRequests = (items) => {
    const list = document.querySelector("#request-list"); list.innerHTML = ""; requests.clear();
    requestSelect.innerHTML = '<option value="">Choose a pending request</option>';
    items.forEach((item) => {
      requests.set(item.id, item);
      const card = document.createElement("button"); card.type = "button"; card.className = "request-item"; card.dataset.requestId = item.id;
      const title = document.createElement("strong"); title.textContent = `${item.requester_name} — ${item.connection_type}`;
      const detail = document.createElement("small"); detail.textContent = `${item.requester_role} • ${item.country} • ${new Date(item.preferred_start).toLocaleString()}`;
      card.append(title, detail); card.addEventListener("click", () => { requestSelect.value = item.id; requestSelect.dispatchEvent(new Event("change")); }); list.append(card);
      const option = document.createElement("option"); option.value = item.id; option.textContent = `${item.requester_name} — ${item.connection_type}`; requestSelect.append(option);
    });
    setStatus(requestStatus, items.length ? `${items.length} request${items.length === 1 ? "" : "s"} awaiting WHSF review.` : "No pending Live Connect requests.", items.length ? "" : "success");
    const requestedId = new URLSearchParams(location.search).get("request");
    if (requestedId && requests.has(requestedId)) { requestSelect.value = requestedId; requestSelect.dispatchEvent(new Event("change")); }
  };

  const loadRequests = async () => {
    setStatus(requestStatus, "Loading pending requests…");
    const { data, error } = await client.from("ai_career_live_connect_requests").select("*").eq("status", "pending").order("created_at", { ascending: true });
    if (error) return setStatus(requestStatus, error.message, "error");
    renderRequests(data || []);
  };

  const enterWorkspace = async (session) => {
    if (!session?.user) return;
    const { data: profile, error } = await client.from("profiles").select("role").eq("id", session.user.id).single();
    if (error || !["admin", "super_admin"].includes(String(profile?.role))) { await client.auth.signOut(); return setStatus(loginStatus, "This account does not have WHSF administrator access.", "error"); }
    adminUser = session.user;
    document.querySelector("#admin-login-card").hidden = true; document.querySelector("#admin-workspace").hidden = false;
    await loadRequests();
  };

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!loginForm.reportValidity() || !client) return;
    const button = loginForm.querySelector("[type=submit]"); button.disabled = true;
    const { data, error } = await client.auth.signInWithPassword({ email: loginForm.elements.email.value.trim(), password: loginForm.elements.password.value }); button.disabled = false;
    if (error) return setStatus(loginStatus, error.message, "error");
    await enterWorkspace(data.session);
  });

  requestSelect.addEventListener("change", () => {
    const item = selectedRequest(); if (!item) return;
    scheduleForm.elements.title.value = `${item.connection_type}: ${item.topic}`.slice(0, 180);
    scheduleForm.elements.description.value = `WHSF-approved ${item.connection_type.toLowerCase()} session focused on ${item.topic}.`;
    scheduleForm.elements.deliveryMode.value = ["Google Meet", "WHSF Live Connect", "Microsoft Teams", "Zoom", "Phone call", "In person"].includes(item.delivery_mode) ? item.delivery_mode : "Google Meet";
    scheduleForm.elements.meetingUrl.placeholder = scheduleForm.elements.deliveryMode.value === "Google Meet" ? "https://meet.google.com/..." : "Secure approved meeting URL";
    setStatus(scheduleStatus, `Reviewing request ${item.id} from ${item.requester_name}.`);
  });

  scheduleForm.elements.deliveryMode.addEventListener("change", () => { scheduleForm.elements.meetingUrl.placeholder = scheduleForm.elements.deliveryMode.value === "Google Meet" ? "https://meet.google.com/..." : "Secure approved meeting URL"; });

  scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault(); const item = selectedRequest(); if (!item || !scheduleForm.reportValidity()) return;
    const starts = new Date(scheduleForm.elements.startsAt.value), ends = new Date(scheduleForm.elements.endsAt.value);
    if (ends <= starts) return setStatus(scheduleStatus, "The end time must be after the start time.", "error");
    const button = scheduleForm.querySelector("[type=submit]"); button.disabled = true; setStatus(scheduleStatus, "Publishing approved session…");
    const { data: session, error: insertError } = await client.from("ai_career_live_sessions").insert({
      title: scheduleForm.elements.title.value.trim(), description: scheduleForm.elements.description.value.trim(), connection_type: item.connection_type,
      host_name: scheduleForm.elements.hostName.value.trim(), host_organisation: scheduleForm.elements.hostOrganisation.value.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", delivery_mode: scheduleForm.elements.deliveryMode.value, public_location: scheduleForm.elements.publicLocation.value.trim(),
      meeting_url: scheduleForm.elements.meetingUrl.value.trim(), capacity: Number(scheduleForm.elements.capacity.value) || null, status: "approved", approved_by: adminUser.id, approved_at: new Date().toISOString()
    }).select("id").single();
    if (insertError) { button.disabled = false; return setStatus(scheduleStatus, insertError.message, "error"); }
    const { error: reviewError } = await client.rpc("ai_career_review_live_connect_request", { p_request_id: item.id, p_decision: "approved", p_admin_notes: scheduleForm.elements.adminNotes.value.trim(), p_public_session_id: session.id });
    button.disabled = false; if (reviewError) return setStatus(scheduleStatus, reviewError.message, "error");
    setStatus(scheduleStatus, "Approved and published. A participant email draft is opening.", "success");
    const roomUrl = `${location.origin}/ai-career-connect/live-connect-room.html?session=${session.id}`;
    openEmail(item.email, `WHSF Live Connect approved — ${scheduleForm.elements.title.value.trim()}`, `Hello ${item.requester_name},\n\nYour WHSF Live Connect request has been approved.\n\nSession: ${scheduleForm.elements.title.value.trim()}\nDate: ${starts.toLocaleString()}\nPlatform: ${scheduleForm.elements.deliveryMode.value}\nSecure authenticated access: ${roomUrl}\n\nPlease do not share meeting access.\n\nWHSF Live Connect`);
    await loadRequests(); scheduleForm.reset(); scheduleForm.elements.hostOrganisation.value = "WHSF"; scheduleForm.elements.publicLocation.value = "Authenticated WHSF Live Connect"; scheduleForm.elements.capacity.value = "100";
  });

  const reviewWithoutSession = async (decision) => {
    const item = selectedRequest(); if (!item) return setStatus(scheduleStatus, "Choose a pending request first.", "error");
    const note = scheduleForm.elements.adminNotes.value.trim();
    const { error } = await client.rpc("ai_career_review_live_connect_request", { p_request_id: item.id, p_decision: decision, p_admin_notes: note, p_public_session_id: null });
    if (error) return setStatus(scheduleStatus, error.message, "error");
    openEmail(item.email, `WHSF Live Connect request — ${decision.replace("_", " ")}`, `Hello ${item.requester_name},\n\nWHSF has reviewed your Live Connect request.\nStatus: ${decision.replace("_", " ")}\n${note ? `Admin note: ${note}\n` : ""}\nRegards,\nWHSF Live Connect`);
    await loadRequests();
  };
  document.querySelector("#needs-changes").addEventListener("click", () => reviewWithoutSession("needs_changes"));
  document.querySelector("#reject-request").addEventListener("click", () => reviewWithoutSession("rejected"));
  document.querySelector("#admin-sign-out").addEventListener("click", async () => { await client.auth.signOut(); location.reload(); });
  client?.auth.getSession().then(({ data }) => enterWorkspace(data.session));
})();
