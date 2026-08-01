(() => {
  const SUPABASE_URL = "https://ophymlgqnfilgxsuzcuz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh";
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  const form = document.querySelector("#room-auth-form");
  const authStatus = document.querySelector("#auth-status");
  const roomStatus = document.querySelector("#room-status");
  const roomSession = document.querySelector("#room-session");
  const placeholder = document.querySelector("#room-placeholder");
  const sessionId = new URLSearchParams(location.search).get("session");

  const setStatus = (element, message, kind = "") => {
    element.textContent = message;
    element.className = `portal-status${kind ? ` ${kind}` : ""}`;
  };

  const renderSession = (session) => {
    const starts = new Date(session.starts_at);
    const ends = new Date(session.ends_at);
    document.querySelector("#room-title").textContent = session.title;
    document.querySelector("#room-description").textContent = session.description || "WHSF-approved Live Connect session.";
    document.querySelector("#room-meta").innerHTML = "";
    [
      starts.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
      `${Math.max(1, Math.round((ends - starts) / 60000))} minutes`,
      session.delivery_mode,
      session.host_organisation || session.host_name
    ].filter(Boolean).forEach((value) => {
      const span = document.createElement("span"); span.textContent = value; document.querySelector("#room-meta").append(span);
    });
    const join = document.querySelector("#room-join");
    if (session.meeting_url) { join.href = session.meeting_url; join.hidden = false; }
    else { join.hidden = true; }
    placeholder.hidden = true; roomSession.hidden = false;
    setStatus(roomStatus, session.meeting_url ? "Authenticated. Your secure session access is ready." : "This session is approved, but the joining link has not been added yet.", session.meeting_url ? "success" : "");
  };

  const loadRoom = async (accessToken) => {
    if (!sessionId) { setStatus(roomStatus, "Choose a session from the public Live Connect calendar."); return; }
    setStatus(roomStatus, "Checking your authenticated session access…");
    try {
      const response = await fetch(`/api/live-connect?session=${encodeURIComponent(sessionId)}`, { headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "This session is unavailable.");
      renderSession(payload.session);
    } catch (error) { setStatus(roomStatus, error.message, "error"); }
  };

  const useSession = async (session) => {
    const signedIn = Boolean(session?.access_token);
    form.hidden = signedIn;
    document.querySelector("#auth-card").querySelector("h2").textContent = signedIn ? `Signed in as ${session.user.email}` : "Sign in to continue";
    if (signedIn) { setStatus(authStatus, "WHSF authentication confirmed.", "success"); await loadRoom(session.access_token); }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!form.reportValidity() || !client) return;
    const button = form.querySelector("[type=submit]"); button.disabled = true;
    const { data, error } = await client.auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
    button.disabled = false;
    if (error) return setStatus(authStatus, error.message, "error");
    await useSession(data.session);
  });

  document.querySelector("#create-account")?.addEventListener("click", async () => {
    if (!form.reportValidity() || !client) return;
    const { data, error } = await client.auth.signUp({ email: form.elements.email.value.trim(), password: form.elements.password.value, options: { emailRedirectTo: location.href } });
    if (error) return setStatus(authStatus, error.message, "error");
    setStatus(authStatus, data.session ? "Account created and signed in." : "Check your email to confirm your WHSF account, then return here.", "success");
    if (data.session) await useSession(data.session);
  });

  document.querySelector("#sign-out")?.addEventListener("click", async () => { await client?.auth.signOut(); location.reload(); });
  client?.auth.getSession().then(({ data }) => useSession(data.session));
})();
