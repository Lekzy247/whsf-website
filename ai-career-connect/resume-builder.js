(() => {
  const storageKey = "whsf-aicc-cv-draft-v1";
  const fields = ["full-name", "professional-title", "email", "phone", "location", "portfolio", "summary", "skills", "template"];
  const state = { experiences: [], education: [] };
  const byId = (id) => document.getElementById(id);
  const value = (id) => byId(id)?.value.trim() || "";
  const escapeHtml = (text) => String(text || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  let toastTimer;

  const showToast = (message) => {
    const toast = byId("ws-toast");
    clearTimeout(toastTimer);
    toast.querySelector("span").textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  };

  const setupNavigation = () => {
    const button = document.querySelector(".workspace-menu");
    const links = document.querySelector(".workspace-links");
    button?.addEventListener("click", () => {
      const open = !links.classList.contains("open");
      links.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
      button.querySelector("[aria-hidden]").textContent = open ? "×" : "☰";
      document.body.classList.toggle("menu-open", open);
    });
    links?.addEventListener("click", (event) => {
      if (!event.target.closest("a")) return;
      links.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  };

  const formatMonth = (raw) => {
    if (!raw) return "";
    const [year, month] = raw.split("-").map(Number);
    return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
  };

  const renderEntryEditors = () => {
    const experienceList = byId("experience-list");
    byId("experience-count").textContent = state.experiences.length;
    experienceList.innerHTML = state.experiences.length ? state.experiences.map((item, index) => `
      <article class="entry-item"><div><strong>${escapeHtml(item.role)} • ${escapeHtml(item.company)}</strong><span>${escapeHtml(formatMonth(item.start))}${item.start && item.end ? " – " : ""}${escapeHtml(formatMonth(item.end) || (item.start ? "Present" : ""))}</span></div><button type="button" data-remove-experience="${index}">Remove</button></article>
    `).join("") : '<p class="empty-state">No experience added yet. Projects, volunteering and internships also count.</p>';

    const educationList = byId("education-list");
    byId("education-count").textContent = state.education.length;
    educationList.innerHTML = state.education.length ? state.education.map((item, index) => `
      <article class="entry-item"><div><strong>${escapeHtml(item.award)}</strong><span>${escapeHtml(item.school)}${item.year ? ` • ${escapeHtml(item.year)}` : ""}</span></div><button type="button" data-remove-education="${index}">Remove</button></article>
    `).join("") : '<p class="empty-state">No education added yet.</p>';
  };

  const renderPreview = () => {
    byId("preview-name").textContent = value("full-name") || "Your Name";
    byId("preview-title").textContent = value("professional-title") || "Professional title";
    const contact = [value("email") || "email@example.com", value("phone"), value("location") || "City, Country", value("portfolio")].filter(Boolean);
    byId("preview-contact").innerHTML = contact.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
    byId("preview-summary").textContent = value("summary") || "Your professional summary will appear here.";
    const skills = value("skills").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 16);
    byId("preview-skills").innerHTML = skills.length ? skills.map((item) => `<span>${escapeHtml(item)}</span>`).join("") : "<span>Add your strongest skills</span>";
    byId("preview-experience").innerHTML = state.experiences.length ? state.experiences.map((item) => `
      <article class="resume-entry"><div class="resume-entry-head"><strong>${escapeHtml(item.role)}</strong><span>${escapeHtml(formatMonth(item.start))}${item.start && item.end ? " – " : ""}${escapeHtml(formatMonth(item.end) || (item.start ? "Present" : ""))}</span></div><small>${escapeHtml(item.company)}</small><p>${escapeHtml(item.detail)}</p></article>
    `).join("") : "<p>No experience added yet.</p>";
    byId("preview-education").innerHTML = state.education.length ? state.education.map((item) => `
      <article class="resume-entry"><div class="resume-entry-head"><strong>${escapeHtml(item.award)}</strong><span>${escapeHtml(item.year)}</span></div><small>${escapeHtml(item.school)}</small><p>${escapeHtml(item.detail)}</p></article>
    `).join("") : "<p>No education added yet.</p>";
    byId("resume-preview").classList.toggle("template-classic", byId("template").value === "classic");
    byId("summary-count").textContent = byId("summary").value.length;
    updateScore();
  };

  const updateScore = () => {
    const tests = [
      value("full-name"), value("professional-title"), value("email"),
      value("summary").length >= 80, value("skills").split(",").filter(Boolean).length >= 4,
      state.experiences.length > 0, state.education.length > 0,
      state.experiences.some((item) => /\d|%/.test(item.detail))
    ];
    const score = Math.round((tests.filter(Boolean).length / tests.length) * 100);
    byId("ats-score").textContent = `${score}%`;
    byId("ats-progress").style.width = `${score}%`;
  };

  const serialize = () => ({
    fields: Object.fromEntries(fields.map((id) => [id, byId(id)?.value || ""])),
    experiences: state.experiences,
    education: state.education,
    updatedAt: new Date().toISOString()
  });

  const save = (announce = true) => {
    localStorage.setItem(storageKey, JSON.stringify(serialize()));
    byId("save-state").textContent = `Saved ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}`;
    if (announce) showToast("Your CV draft was saved on this device.");
  };

  const load = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved) return;
      Object.entries(saved.fields || {}).forEach(([id, fieldValue]) => { if (byId(id)) byId(id).value = fieldValue; });
      state.experiences = Array.isArray(saved.experiences) ? saved.experiences : [];
      state.education = Array.isArray(saved.education) ? saved.education : [];
      byId("save-state").textContent = "Saved draft restored";
    } catch {
      localStorage.removeItem(storageKey);
    }
  };

  const downloadText = () => {
    const lines = [
      value("full-name") || "Your Name",
      value("professional-title"),
      [value("email"), value("phone"), value("location"), value("portfolio")].filter(Boolean).join(" | "),
      "", "PROFESSIONAL SUMMARY", value("summary"), "", "CORE SKILLS", value("skills"),
      "", "EXPERIENCE",
      ...state.experiences.flatMap((item) => [`${item.role} — ${item.company}`, `${formatMonth(item.start)} – ${formatMonth(item.end) || "Present"}`, item.detail, ""]),
      "EDUCATION",
      ...state.education.flatMap((item) => [`${item.award} — ${item.school}`, [item.year, item.detail].filter(Boolean).join(" | "), ""])
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(value("full-name") || "career-connect").replace(/\s+/g, "-").toLowerCase()}-cv.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Your CV text file was downloaded.");
  };

  fields.forEach((id) => byId(id)?.addEventListener(id === "template" ? "change" : "input", renderPreview));
  byId("experience-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    state.experiences.push({ role: value("experience-role"), company: value("experience-company"), start: byId("experience-start").value, end: byId("experience-end").value, detail: value("experience-detail") });
    form.reset();
    renderEntryEditors();
    renderPreview();
    save(false);
  });
  byId("education-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    state.education.push({ award: value("education-award"), school: value("education-school"), year: value("education-year"), detail: value("education-detail") });
    form.reset();
    renderEntryEditors();
    renderPreview();
    save(false);
  });
  document.addEventListener("click", (event) => {
    const experienceIndex = event.target.dataset.removeExperience;
    const educationIndex = event.target.dataset.removeEducation;
    if (experienceIndex !== undefined) state.experiences.splice(Number(experienceIndex), 1);
    if (educationIndex !== undefined) state.education.splice(Number(educationIndex), 1);
    if (experienceIndex !== undefined || educationIndex !== undefined) {
      renderEntryEditors();
      renderPreview();
      save(false);
    }
  });
  byId("save-cv").addEventListener("click", () => save(true));
  byId("print-cv").addEventListener("click", () => window.print());
  byId("download-cv").addEventListener("click", downloadText);
  byId("clear-cv").addEventListener("click", () => {
    if (!window.confirm("Clear this CV draft from this device? This cannot be undone.")) return;
    localStorage.removeItem(storageKey);
    fields.forEach((id) => { if (byId(id) && id !== "template") byId(id).value = ""; });
    byId("template").value = "modern";
    state.experiences = [];
    state.education = [];
    renderEntryEditors();
    renderPreview();
    byId("save-state").textContent = "Draft cleared";
    showToast("CV draft cleared.");
  });
  byId("ws-toast").querySelector("button").addEventListener("click", () => { byId("ws-toast").hidden = true; });

  setupNavigation();
  load();
  renderEntryEditors();
  renderPreview();
})();
