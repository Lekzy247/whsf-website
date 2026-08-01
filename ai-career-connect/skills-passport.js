(() => {
  const storageKey = "whsf-aicc-skills-passport-v1";
  const byId = (id) => document.getElementById(id);
  const value = (id) => byId(id)?.value.trim() || "";
  const escapeHtml = (text) => String(text || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const profileFields = ["passport-name", "passport-title", "passport-location", "passport-link", "passport-summary"];
  const state = { id: "", skills: [], credentials: [], projects: [] };
  let toastTimer;

  const createId = () => `AICC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const safeUrl = (url) => {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  };
  const showToast = (message) => {
    const toast = byId("passport-toast");
    clearTimeout(toastTimer);
    toast.querySelector("span").textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  };
  const setupNavigation = () => {
    const button = document.querySelector(".workspace-menu");
    const links = document.querySelector(".workspace-links");
    button.addEventListener("click", () => {
      const open = !links.classList.contains("open");
      links.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
      button.querySelector("[aria-hidden]").textContent = open ? "×" : "☰";
      document.body.classList.toggle("menu-open", open);
    });
  };

  const levelName = (level) => ["", "Foundation", "Developing", "Proficient", "Advanced", "Expert"][Number(level)] || "Proficient";
  const levelBars = (level) => Array.from({ length: 5 }, (_, index) => `<i class="${index < Number(level) ? "filled" : ""}"></i>`).join("");

  const renderEditors = () => {
    byId("skill-count").textContent = state.skills.length;
    byId("skill-list").innerHTML = state.skills.length ? state.skills.map((item, index) => `<article class="entry-item"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} • ${escapeHtml(levelName(item.level))}</span></div><button type="button" data-remove-skill="${index}">Remove</button></article>`).join("") : '<p class="empty-state">No skills added yet.</p>';
    byId("credential-count").textContent = state.credentials.length;
    byId("credential-list-editor").innerHTML = state.credentials.length ? state.credentials.map((item, index) => `<article class="entry-item"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.issuer)}${item.year ? ` • ${escapeHtml(item.year)}` : ""}</span></div><button type="button" data-remove-credential="${index}">Remove</button></article>`).join("") : '<p class="empty-state">No credentials added yet.</p>';
    byId("project-count").textContent = state.projects.length;
    byId("project-list-editor").innerHTML = state.projects.length ? state.projects.map((item, index) => `<article class="entry-item"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.impact.slice(0, 90))}${item.impact.length > 90 ? "…" : ""}</span></div><button type="button" data-remove-project="${index}">Remove</button></article>`).join("") : '<p class="empty-state">No projects added yet.</p>';
  };

  const renderPreview = () => {
    byId("passport-preview-name").textContent = value("passport-name") || "Your Name";
    byId("passport-preview-title").textContent = value("passport-title") || "Career focus";
    const meta = [value("passport-location"), value("passport-link")].filter(Boolean);
    byId("passport-preview-meta").textContent = meta.join(" • ") || "Location • Portfolio";
    byId("passport-preview-summary").textContent = value("passport-summary") || "Your professional statement will appear here.";
    byId("passport-id").textContent = state.id;
    byId("passport-preview-skills").innerHTML = state.skills.length ? state.skills.map((item) => `<article class="passport-skill"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} • ${escapeHtml(levelName(item.level))}</span></div><div class="level-dots" aria-label="${escapeHtml(levelName(item.level))} proficiency">${levelBars(item.level)}</div></article>`).join("") : "<p>No skills added yet.</p>";
    byId("passport-preview-credentials").innerHTML = state.credentials.length ? state.credentials.map((item) => {
      const evidence = safeUrl(item.evidence);
      return `<article class="passport-record"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.issuer)}${item.year ? ` • ${escapeHtml(item.year)}` : ""}${evidence ? `<br><a href="${escapeHtml(evidence)}" target="_blank" rel="noreferrer">View evidence</a>` : ""}</small></div><span class="record-status ${evidence ? "" : "self"}">${evidence ? "Evidence linked" : "Self-declared"}</span></article>`;
    }).join("") : "<p>No credentials added yet.</p>";
    byId("passport-preview-projects").innerHTML = state.projects.length ? state.projects.map((item) => {
      const link = safeUrl(item.link);
      return `<article class="passport-record"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.impact)}${link ? `<br><a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">View project</a>` : ""}</small></div><span class="record-status self">Project</span></article>`;
    }).join("") : "<p>No projects added yet.</p>";
    updateScore();
  };

  const updateScore = () => {
    const checks = [value("passport-name"), value("passport-title"), value("passport-summary").length >= 60, state.skills.length >= 3, state.credentials.length > 0, state.projects.length > 0];
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    byId("passport-score").textContent = `${score}%`;
    byId("passport-progress").style.width = `${score}%`;
  };

  const serialize = () => ({ id: state.id, profile: Object.fromEntries(profileFields.map((id) => [id, byId(id).value])), skills: state.skills, credentials: state.credentials, projects: state.projects, updatedAt: new Date().toISOString() });
  const save = (announce = true) => {
    localStorage.setItem(storageKey, JSON.stringify(serialize()));
    byId("passport-save-state").textContent = `Saved ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}`;
    if (announce) showToast("Your Skills Passport was saved on this device.");
  };
  const load = () => {
    state.id = createId();
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return;
      state.id = saved.id || state.id;
      Object.entries(saved.profile || {}).forEach(([id, fieldValue]) => { if (byId(id)) byId(id).value = fieldValue; });
      state.skills = Array.isArray(saved.skills) ? saved.skills : [];
      state.credentials = Array.isArray(saved.credentials) ? saved.credentials : [];
      state.projects = Array.isArray(saved.projects) ? saved.projects : [];
      byId("passport-save-state").textContent = "Saved passport restored";
    } catch {
      localStorage.removeItem(storageKey);
    }
  };

  profileFields.forEach((id) => byId(id).addEventListener("input", renderPreview));
  byId("skill-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    state.skills.push({ name: value("skill-name"), category: byId("skill-category").value, level: byId("skill-level").value });
    event.currentTarget.reset();
    byId("skill-level").value = "3";
    renderEditors(); renderPreview(); save(false);
  });
  byId("credential-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    state.credentials.push({ name: value("credential-name"), issuer: value("credential-issuer"), year: value("credential-year"), evidence: value("credential-evidence") });
    event.currentTarget.reset();
    renderEditors(); renderPreview(); save(false);
  });
  byId("project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    state.projects.push({ name: value("project-name"), impact: value("project-impact"), link: value("project-link") });
    event.currentTarget.reset();
    renderEditors(); renderPreview(); save(false);
  });
  document.addEventListener("click", (event) => {
    const groups = [["removeSkill", state.skills], ["removeCredential", state.credentials], ["removeProject", state.projects]];
    const match = groups.find(([dataset]) => event.target.dataset[dataset] !== undefined);
    if (!match) return;
    match[1].splice(Number(event.target.dataset[match[0]]), 1);
    renderEditors(); renderPreview(); save(false);
  });
  byId("save-passport").addEventListener("click", () => save(true));
  byId("print-passport").addEventListener("click", () => window.print());
  byId("download-passport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(value("passport-name") || "career-connect").replace(/\s+/g, "-").toLowerCase()}-skills-passport.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Your Skills Passport data was downloaded.");
  });
  byId("clear-passport").addEventListener("click", () => {
    if (!window.confirm("Clear this Skills Passport from this device? This cannot be undone.")) return;
    localStorage.removeItem(storageKey);
    profileFields.forEach((id) => { byId(id).value = ""; });
    state.id = createId(); state.skills = []; state.credentials = []; state.projects = [];
    renderEditors(); renderPreview();
    byId("passport-save-state").textContent = "Passport cleared";
    showToast("Skills Passport cleared.");
  });
  byId("passport-toast").querySelector("button").addEventListener("click", () => { byId("passport-toast").hidden = true; });

  setupNavigation();
  load();
  renderEditors();
  renderPreview();
})();
