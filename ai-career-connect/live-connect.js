(() => {
  const form = document.querySelector("#live-connect-form");
  const status = document.querySelector("#live-connect-status");
  const list = document.querySelector("#live-session-list");
  const monthInput = document.querySelector("#live-connect-month");
  const refreshButton = document.querySelector("#live-calendar-refresh");
  const emailNotificationLink = document.querySelector("#live-email-notification");
  if (!form || !status || !list || !monthInput) return;

  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character]);
  const today = new Date();
  monthInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  form.elements.preferredDate.min = today.toISOString().slice(0, 10);
  form.elements.timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const monthRange = () => {
    const [year, month] = monthInput.value.split("-").map(Number);
    return {
      from: new Date(Date.UTC(year, month - 1, 1)),
      to: new Date(Date.UTC(year, month, 1))
    };
  };

  const readPayload = async (response) => {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; }
    catch { return { error: response.ok ? "The server returned an unreadable response." : "This service is not available in the local preview." }; }
  };

  const downloadCalendar = (session) => {
    const dateValue = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const cleanIcs = (value) => String(value || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//WHSF//AI Career Connect//EN", "BEGIN:VEVENT",
      `UID:${session.id}@worldhsfoundation.org`, `DTSTAMP:${dateValue(new Date())}`,
      `DTSTART:${dateValue(session.starts_at)}`, `DTEND:${dateValue(session.ends_at)}`,
      `SUMMARY:${cleanIcs(session.title)}`, `DESCRIPTION:${cleanIcs(`${session.description || "WHSF-approved Live Connect session."}${session.registration_url ? ` Register: ${session.registration_url}` : ""}`)}`,
      `LOCATION:${cleanIcs(session.public_location || session.delivery_mode || "Online")}`, "END:VEVENT", "END:VCALENDAR"
    ];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
    link.download = "whsf-live-connect.ics";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderSessions = (sessions) => {
    if (!sessions.length) {
      list.innerHTML = '<div class="live-empty"><div><strong>No approved public sessions this month.</strong>Submit a connection request and WHSF can help coordinate one.</div></div>';
      return;
    }
    list.innerHTML = sessions.map((session) => {
      const starts = new Date(session.starts_at);
      const time = starts.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
      return `<article class="live-session">
        <div class="live-session-date"><strong>${starts.getDate()}</strong><small>${starts.toLocaleDateString([], { month: "short" })}</small></div>
        <div><h4>${escapeHTML(session.title)}</h4><p>${escapeHTML(session.description || "WHSF-approved connection session.")}</p>
        <div class="live-session-meta"><span>${escapeHTML(time)}</span><span>${escapeHTML(session.connection_type)}</span><span>${escapeHTML(session.delivery_mode)}</span></div>
        <div class="live-session-actions"><a href="/ai-career-connect/live-connect-room.html?session=${encodeURIComponent(session.id)}">Sign in to access live room →</a><button type="button" data-calendar-id="${escapeHTML(session.id)}">Add to calendar</button></div></div>
      </article>`;
    }).join("");
    list.querySelectorAll("[data-calendar-id]").forEach((button) => button.addEventListener("click", () => downloadCalendar(sessions.find((session) => session.id === button.dataset.calendarId))));
  };

  const loadSessions = async () => {
    list.setAttribute("aria-busy", "true");
    list.innerHTML = '<div class="live-session-loading"><span></span><span></span><span></span><p>Checking the approved calendar…</p></div>';
    const { from, to } = monthRange();
    try {
      const response = await fetch(`/api/live-connect?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, { headers: { Accept: "application/json" } });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "The approved calendar is unavailable.");
      renderSessions(payload.sessions || []);
    } catch (error) {
      list.innerHTML = `<div class="live-empty"><div><strong>Calendar temporarily unavailable.</strong>${escapeHTML(error.message)}</div></div>`;
    } finally {
      list.removeAttribute("aria-busy");
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    status.className = "live-form-status";
    status.textContent = "Sending your request securely for WHSF review…";
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const response = await fetch("/api/live-connect", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(payload.error || "Your request could not be submitted.");
      status.classList.add("success");
      status.textContent = payload.message || "Request received. WHSF will review it before any session is scheduled.";
      if (emailNotificationLink && payload.approvalMailto) {
        emailNotificationLink.href = payload.approvalMailto;
        emailNotificationLink.hidden = false;
        emailNotificationLink.textContent = payload.emailDelivered ? `WHSF notified • Request ${payload.requestId}` : `Email WHSF for approval • Request ${payload.requestId} →`;
        if (!payload.emailDelivered) window.setTimeout(() => { window.location.href = payload.approvalMailto; }, 350);
      }
      form.reset();
      form.elements.preferredDate.min = new Date().toISOString().slice(0, 10);
      form.elements.timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch (error) {
      status.classList.add("error");
      status.textContent = `${error.message} You may also email info@worldhsfoundation.org.`;
      if (emailNotificationLink) emailNotificationLink.hidden = true;
    } finally { button.disabled = false; }
  });

  monthInput.addEventListener("change", loadSessions);
  refreshButton?.addEventListener("click", loadSessions);
  loadSessions();
})();
