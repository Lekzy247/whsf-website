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
      copy: "Compare eligibility, requirements and deadlines for leading international scholarship programmes.",
      items: [
        ["FL", "Fulbright Foreign Student Program", "United States • Postgraduate", "High fit"],
        ["CM", "Commonwealth Master’s Scholarships", "United Kingdom • Master’s", "Eligible"],
        ["DA", "DAAD Development-Related Courses", "Germany • Postgraduate", "82% fit"]
      ]
    },
    internships: {
      kicker: "Internships",
      heading: "Experience that moves your career forward",
      copy: "Find structured placements across health, technology, development, research and business.",
      items: [
        ["WH", "Global Health Programme Internship", "Hybrid • 6 months", "88% fit"],
        ["UN", "Youth Innovation Internship", "Remote • 4 months", "New"],
        ["ST", "Sustainable Technology Fellowship", "On-site • 12 weeks", "84% fit"]
      ]
    },
    remote: {
      kicker: "Remote work",
      heading: "Work globally from where you are",
      copy: "Discover verified remote, contract and freelance roles with skills-based matching.",
      items: [
        ["DA", "Junior Data Analyst", "Remote • Full time", "91% fit"],
        ["PC", "Programme Coordinator", "Remote • Contract", "Strong fit"],
        ["UX", "Research Assistant", "Remote • Part time", "New"]
      ]
    },
    exchange: {
      kicker: "Student exchange",
      heading: "Turn global study into a practical plan",
      copy: "Explore exchanges, summer programmes and research opportunities with deadline and budget guidance.",
      items: [
        ["ER", "Erasmus+ Exchange Pathway", "Europe • One semester", "Eligible"],
        ["SU", "Global Summer Research Programme", "Canada • 10 weeks", "86% fit"],
        ["GX", "Social Innovation Exchange", "Ireland • One semester", "High fit"]
      ]
    }
  };

  const renderOpportunity = (key) => {
    const data = opportunityData[key];
    if (!data) return;
    document.querySelector("#opportunity-kicker").textContent = data.kicker;
    document.querySelector("#opportunity-heading").textContent = data.heading;
    document.querySelector("#opportunity-copy").textContent = data.copy;
    document.querySelector("#opportunity-list").innerHTML = data.items.map(([logo, name, meta, fit]) => `
      <article class="opportunity-item">
        <span class="opportunity-logo" aria-hidden="true">${logo}</span>
        <div><strong>${name}</strong><small>${meta}</small></div>
        <span>${fit}</span>
      </article>
    `).join("");
    const panel = document.querySelector("#opportunity-panel");
    panel.setAttribute("aria-labelledby", `tab-${key}`);
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
    });
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      tabs[(index + direction + tabs.length) % tabs.length].focus();
      tabs[(index + direction + tabs.length) % tabs.length].click();
    });
  });

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
