(() => {
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".primary-nav");
  const header = document.querySelector(".site-header");
  const filterButtons = [...document.querySelectorAll("[data-filter]")];
  const toolCards = [...document.querySelectorAll(".tool-card")];
  const careerForm = document.querySelector("#career-form");
  const result = document.querySelector("#assessment-result");
  const toast = document.querySelector("#demo-toast");
  const toastTitle = document.querySelector("#toast-title");
  let toastTimer;

  const closeMenu = () => {
    if (!menuButton || !navigation) return;
    navigation.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.querySelector("[aria-hidden]").textContent = "☰";
    document.body.classList.remove("menu-open");
  };

  menuButton?.addEventListener("click", () => {
    const willOpen = !navigation.classList.contains("open");
    navigation.classList.toggle("open", willOpen);
    menuButton.setAttribute("aria-expanded", String(willOpen));
    menuButton.querySelector("[aria-hidden]").textContent = willOpen ? "×" : "☰";
    document.body.classList.toggle("menu-open", willOpen);
  });

  navigation?.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  window.addEventListener("scroll", () => {
    header?.classList.toggle("scrolled", window.scrollY > 12);
  }, { passive: true });

  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" });
    });
  });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.filter;
      filterButtons.forEach((item) => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      toolCards.forEach((card) => {
        card.hidden = category !== "all" && card.dataset.category !== category;
      });
    });
  });

  const careerMatches = {
    technology: ["Data & AI Solutions Analyst", "91% match", "Your interest in technology points to roles that combine analytical thinking, digital tools and practical problem-solving."],
    health: ["Health Data Analyst", "89% match", "Your interests align with a pathway combining health knowledge, research and evidence-led decision-making."],
    business: ["Digital Business Strategist", "87% match", "Your business focus connects strongly to opportunity analysis, innovation and sustainable growth."],
    humanitarian: ["Humanitarian Programme Analyst", "92% match", "Your impact focus fits work that uses data, coordination and community insight to improve programmes."],
    creative: ["Digital Communications Strategist", "86% match", "Your creative interests can translate into storytelling, audience insight and technology-enabled communication."],
    engineering: ["Sustainability Project Engineer", "88% match", "Your interests fit applied engineering work that improves systems, resilience and environmental outcomes."]
  };

  careerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!careerForm.reportValidity()) return;
    const match = careerMatches[careerForm.elements.interest.value] || careerMatches.technology;
    document.querySelector("#result-title").textContent = match[0];
    document.querySelector("#result-score").textContent = match[1];
    document.querySelector("#result-copy").textContent = match[2];
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  const opportunityData = {
    scholarships: {
      kicker: "Scholarships",
      heading: "Funding pathways matched to your profile",
      copy: "Check current funding information on official scholarship programme websites.",
      items: [
        { title: "Commonwealth Master's Scholarships", organisation: "Commonwealth Scholarship Commission", location: "United Kingdom", summary: "Open the official programme page for eligibility and the current application window.", url: "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/", tag: "Official portal" },
        { title: "Fulbright Foreign Student Program", organisation: "U.S. Department of State", location: "United States", summary: "Country-specific application information from the official Fulbright programme.", url: "https://foreign.fulbrightonline.org/about/foreign-fulbright", tag: "Official portal" },
        { title: "DAAD Scholarship Database", organisation: "DAAD", location: "Germany", summary: "Official scholarship search for international students, graduates and researchers.", url: "https://www.daad.de/en/studying-in-germany/scholarships/daad-scholarship-database/", tag: "Official portal" }
      ]
    },
    internships: {
      kicker: "Internships",
      heading: "Experience that moves your career forward",
      copy: "Fetch published internships and early-career roles directly from participating employers' job boards.",
      items: [
        { title: "Erasmus+ traineeships abroad", organisation: "European Union", location: "Eligible international placements", summary: "Official guidance for students and recent graduates seeking supported traineeships.", url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/traineeships-abroad-for-students", tag: "Official portal" },
        { title: "Cloudflare early-career opportunities", organisation: "Cloudflare", location: "Multiple locations", summary: "Fetch current internship postings from the employer's public job board.", url: "https://www.cloudflare.com/careers/jobs/", tag: "Employer portal" },
        { title: "Canonical graduate careers", organisation: "Canonical", location: "Global", summary: "Fetch current graduate and early-career roles from the employer's public job board.", url: "https://canonical.com/careers/all", tag: "Employer portal" }
      ]
    },
    remote: {
      kicker: "Remote work",
      heading: "Work globally from where you are",
      copy: "Fetch remote and distributed roles directly from employers' published job boards.",
      items: [
        { title: "GitLab remote careers", organisation: "GitLab", location: "Distributed", summary: "Current roles from GitLab's public employer job board.", url: "https://about.gitlab.com/jobs/", tag: "Employer portal" },
        { title: "Wikimedia Foundation careers", organisation: "Wikimedia Foundation", location: "Remote", summary: "Current remote roles from the Foundation's public employer job board.", url: "https://wikimediafoundation.org/about/jobs/", tag: "Employer portal" },
        { title: "Mozilla careers", organisation: "Mozilla", location: "Multiple remote locations", summary: "Current roles from Mozilla's public employer job board.", url: "https://www.mozilla.org/careers/", tag: "Employer portal" }
      ]
    },
    exchange: {
      kicker: "Student exchange",
      heading: "Turn global study into a practical plan",
      copy: "Check participation and application guidance directly on official exchange programme websites.",
      items: [
        { title: "Erasmus+ studying abroad", organisation: "European Union", location: "Programme and partner countries", summary: "Official participation, duration and funding guidance for student exchanges.", url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/studying-abroad", tag: "Official portal" },
        { title: "Erasmus+ Youth Exchanges", organisation: "European Union", location: "Europe and partner countries", summary: "Official information about short international learning exchanges for young people.", url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/youth-exchanges", tag: "Official portal" },
        { title: "Exchange Programs for non-U.S. participants", organisation: "U.S. Department of State", location: "United States and participating countries", summary: "Official academic, professional and cultural exchange programme finder.", url: "https://exchanges.state.gov/non-us/program", tag: "Official portal" }
      ]
    },
    conferences: {
      kicker: "Conferences",
      heading: "Current technology and global-impact events",
      copy: "Explore official conference pages, with priority given to AI, cloud, cybersecurity and digital skills useful to WHSF employees.",
      items: [
        { title: "Microsoft Ignite 2026", organisation: "Microsoft", location: "San Francisco + online", detail: "17–20 November 2026 • AI, cloud and practical technology skills for IT professionals, developers and leaders.", url: "https://ignite.microsoft.com/", tag: "WHSF staff priority" },
        { title: "AWS re:Invent 2026", organisation: "Amazon Web Services", location: "Las Vegas + selected livestreams", detail: "30 November–4 December 2026 • Cloud, AI, security, architecture and hands-on technical learning.", url: "https://aws.amazon.com/events/reinvent/", tag: "Cloud & AI" },
        { title: "Google Cloud events", organisation: "Google Cloud", location: "Global + online", detail: "Official live and on-demand events across AI, data, security, infrastructure and collaboration.", url: "https://cloud.google.com/events", tag: "Official event hub" }
      ]
    }
  };

  const opportunityPanel = document.querySelector("#opportunity-panel");
  const opportunityList = document.querySelector("#opportunity-list");
  const opportunityStatus = document.querySelector("#opportunity-status");
  const opportunityButton = document.querySelector("#opportunity-fetch-button");
  const opportunityButtonLabel = opportunityButton?.querySelector("[data-opportunity-button-label]");
  const liveOpportunityCache = new Map();
  let activeOpportunityKey = "scholarships";
  let opportunityRequest;

  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character]);

  const sourceInitials = (item) => (item.organisation || item.title || "OP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const formatSourceDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : `Updated ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  };

  const renderOpportunityItems = (items) => {
    opportunityList.innerHTML = items.map((item) => {
      const sourceDate = formatSourceDate(item.sourceUpdatedAt);
      const supportingText = item.detail || item.applicationStatus || item.summary || "Review the source for full requirements and participation details.";
      return `
        <a class="opportunity-item" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">
          <span class="opportunity-logo" aria-hidden="true">${escapeHTML(sourceInitials(item))}</span>
          <div>
            <strong>${escapeHTML(item.title)}</strong>
            <small>${escapeHTML(item.organisation)} &bull; ${escapeHTML(item.location)}</small>
            <em>${escapeHTML(supportingText)}</em>
            ${sourceDate ? `<small>${escapeHTML(sourceDate)}</small>` : ""}
          </div>
          <span class="opportunity-tag">${escapeHTML(item.tag || item.sourceStatus || "Direct source")}</span>
        </a>
      `;
    }).join("");
  };

  const renderOpportunity = (key) => {
    const data = opportunityData[key];
    if (!data) return;
    activeOpportunityKey = key;
    document.querySelector("#opportunity-kicker").textContent = data.kicker;
    document.querySelector("#opportunity-heading").textContent = data.heading;
    document.querySelector("#opportunity-copy").textContent = data.copy;
    renderOpportunityItems(liveOpportunityCache.get(key)?.items || data.items);
    opportunityPanel.setAttribute("aria-labelledby", `tab-${key}`);
    if (liveOpportunityCache.has(key)) {
      const cached = liveOpportunityCache.get(key);
      opportunityStatus.textContent = `${cached.items.length} live results fetched from ${cached.sourceKind}. Checked ${new Date(cached.fetchedAt).toLocaleString()}.`;
      if (opportunityButtonLabel) opportunityButtonLabel.textContent = "Refresh live results";
    } else {
      opportunityStatus.textContent = "Showing trusted source links. Fetch live opportunities for current listings and source status.";
      if (opportunityButtonLabel) opportunityButtonLabel.textContent = "Open live opportunity finder";
    }
  };

  const fetchOpportunities = async (key = activeOpportunityKey) => {
    opportunityRequest?.abort();
    opportunityRequest = new AbortController();
    opportunityButton.disabled = true;
    opportunityPanel.setAttribute("aria-busy", "true");
    if (opportunityButtonLabel) opportunityButtonLabel.textContent = "Fetching live results...";
    opportunityStatus.classList.remove("error");
    opportunityStatus.textContent = `Connecting to live ${opportunityData[key].kicker.toLowerCase()} sources...`;
    opportunityList.innerHTML = '<div class="opportunity-loading" aria-hidden="true"><span></span><span></span><span></span></div>';

    try {
      const response = await fetch(`/api/opportunities?type=${encodeURIComponent(key)}`, {
        signal: opportunityRequest.signal,
        headers: { Accept: "application/json" }
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Live sources did not respond.");
      liveOpportunityCache.set(key, payload);
      if (activeOpportunityKey === key) renderOpportunity(key);
    } catch (error) {
      if (error.name === "AbortError") return;
      opportunityStatus.classList.add("error");
      opportunityStatus.textContent = `${error.message} Trusted direct-source links are shown below; try again shortly.`;
      renderOpportunityItems(opportunityData[key].items);
    } finally {
      if (activeOpportunityKey === key) {
        opportunityButton.disabled = false;
        opportunityPanel.removeAttribute("aria-busy");
        if (opportunityButtonLabel) opportunityButtonLabel.textContent = liveOpportunityCache.has(key) ? "Refresh live results" : "Try live search again";
      }
    }
  };

  const tabs = [...document.querySelectorAll("[data-tab]")];
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => {
        const active = item === tab;
        item.setAttribute("aria-selected", String(active));
        item.tabIndex = active ? 0 : -1;
      });
      renderOpportunity(tab.dataset.tab);
      if (!liveOpportunityCache.has(tab.dataset.tab)) fetchOpportunities(tab.dataset.tab);
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      tabs[(index + direction + tabs.length) % tabs.length].focus();
      tabs[(index + direction + tabs.length) % tabs.length].click();
    });
  });

  opportunityButton?.addEventListener("click", () => fetchOpportunities(activeOpportunityKey));

  const showToast = (title) => {
    if (!toast) return;
    clearTimeout(toastTimer);
    toastTitle.textContent = title;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
  };

  document.querySelectorAll("[data-demo]").forEach((button) => {
    button.addEventListener("click", () => showToast(button.dataset.demo));
  });
  toast?.querySelector("button")?.addEventListener("click", () => {
    clearTimeout(toastTimer);
    toast.hidden = true;
  });

  renderOpportunity("scholarships");
  const year = document.querySelector("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
