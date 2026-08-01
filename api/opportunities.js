const OFFICIAL_PROGRAMMES = {
  scholarships: [
    {
      id: "commonwealth-masters",
      title: "Commonwealth Master's Scholarships",
      organisation: "Commonwealth Scholarship Commission",
      location: "United Kingdom",
      summary: "Government-funded Master's study for eligible candidates from low and middle income Commonwealth countries.",
      url: "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/"
    },
    {
      id: "fulbright-foreign-student",
      title: "Fulbright Foreign Student Program",
      organisation: "U.S. Department of State",
      location: "United States",
      summary: "Graduate study and research opportunities for international students through participating Fulbright commissions and U.S. embassies.",
      url: "https://foreign.fulbrightonline.org/about/foreign-fulbright"
    },
    {
      id: "daad-scholarships",
      title: "DAAD Scholarship Database",
      organisation: "German Academic Exchange Service (DAAD)",
      location: "Germany",
      summary: "Official funding opportunities for international students, graduates, doctoral candidates and researchers.",
      url: "https://www.daad.de/en/studying-in-germany/scholarships/daad-scholarship-database/"
    },
    {
      id: "erasmus-mundus",
      title: "Erasmus Mundus Joint Masters",
      organisation: "European Union",
      location: "Europe and partner countries",
      summary: "Joint international Master's programmes that may offer full scholarships to students worldwide.",
      url: "https://erasmus-plus.ec.europa.eu/opportunities/opportunities-for-individuals/students/erasmus-mundus-joint-masters"
    }
  ],
  exchange: [
    {
      id: "erasmus-study-abroad",
      title: "Erasmus+ studying abroad",
      organisation: "European Union",
      location: "Erasmus+ programme and partner countries",
      summary: "Supported exchanges for eligible Bachelor, Master and doctoral students through participating institutions.",
      url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/studying-abroad"
    },
    {
      id: "erasmus-youth-exchanges",
      title: "Erasmus+ Youth Exchanges",
      organisation: "European Union",
      location: "Europe and partner countries",
      summary: "Short international learning exchanges for young people, organised through participating youth organisations.",
      url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/youth-exchanges"
    },
    {
      id: "us-exchange-programmes",
      title: "Exchange Programs for non-U.S. participants",
      organisation: "U.S. Department of State",
      location: "United States and participating countries",
      summary: "Official academic, professional and cultural exchange programmes for international applicants.",
      url: "https://exchanges.state.gov/non-us/program"
    },
    {
      id: "erasmus-traineeships",
      title: "Erasmus+ traineeships abroad",
      organisation: "European Union",
      location: "Worldwide eligible placements",
      summary: "Supported work placements for students and recent graduates at eligible organisations.",
      url: "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/traineeships-abroad-for-students"
    }
  ],
  conferences: [
    {
      id: "microsoft-ignite-2026",
      title: "Microsoft Ignite 2026",
      organisation: "Microsoft",
      location: "San Francisco + online",
      detail: "17–20 November 2026 • Frontier AI, cloud and practical skills for IT professionals, developers and leaders.",
      url: "https://ignite.microsoft.com/",
      tag: "WHSF staff priority",
      kind: "conference"
    },
    {
      id: "aws-reinvent-2026",
      title: "AWS re:Invent 2026",
      organisation: "Amazon Web Services",
      location: "Las Vegas + selected livestreams",
      detail: "30 November–4 December 2026 • Cloud, AI, cybersecurity, architecture and hands-on technical learning.",
      url: "https://aws.amazon.com/events/reinvent/",
      tag: "Cloud & AI",
      kind: "conference"
    },
    {
      id: "google-cloud-events",
      title: "Google Cloud events",
      organisation: "Google Cloud",
      location: "Global + online",
      detail: "Current official events and on-demand sessions in AI, data, security, infrastructure and collaboration.",
      url: "https://cloud.google.com/events",
      tag: "Tech learning",
      kind: "conference"
    },
    {
      id: "un-general-assembly-81",
      title: "UN General Assembly 81 High-Level Week",
      organisation: "United Nations",
      location: "New York + UN Web TV",
      detail: "22–28 September 2026 • Global policy, partnerships, sustainable development and humanitarian priorities.",
      url: "https://www.un.org/en/ga/81/meetings/",
      tag: "UN & partnerships",
      kind: "conference"
    },
    {
      id: "un-cop31",
      title: "UN Climate Change Conference (COP31)",
      organisation: "United Nations Framework Convention on Climate Change",
      location: "Antalya, Türkiye",
      detail: "9–20 November 2026 • Climate action, innovation, resilience and sustainable technology.",
      url: "https://www.un.org/en/academic-impact/2026-calendar-selected-united-nations-events",
      tag: "Climate technology",
      kind: "conference"
    },
    {
      id: "itu-ai-for-good-events",
      title: "AI for Good events",
      organisation: "International Telecommunication Union",
      location: "Geneva + online",
      detail: "Ongoing official events connecting responsible AI and emerging technology with the UN Sustainable Development Goals.",
      url: "https://aiforgood.itu.int/events/",
      tag: "AI for SDGs",
      kind: "conference"
    },
    {
      id: "ieee-conferences",
      title: "IEEE conference search",
      organisation: "Institute of Electrical and Electronics Engineers",
      location: "Global + hybrid",
      detail: "Search current technical conferences across AI, computing, engineering, communications and humanitarian technology.",
      url: "https://www.ieee.org/conferences/index.html",
      tag: "Research & engineering",
      kind: "conference"
    }
  ]
};

const JOB_BOARDS = {
  internships: [
    ["cloudflare", "Cloudflare"],
    ["canonical", "Canonical"],
    ["mozilla", "Mozilla"],
    ["stripe", "Stripe"]
  ],
  remote: [
    ["gitlab", "GitLab"],
    ["wikimedia", "Wikimedia Foundation"],
    ["mozilla", "Mozilla"],
    ["canonical", "Canonical"],
    ["cloudflare", "Cloudflare"]
  ]
};

const ALLOWED_TYPES = new Set(["scholarships", "internships", "remote", "exchange", "conferences"]);
const INTERNSHIP_PATTERN = /\b(intern(ship)?|student|graduate|trainee|apprentice)\b/i;
const REMOTE_PATTERN = /\b(remote|home[ -]based|distributed|anywhere)\b/i;

const fetchWithTimeout = async (url, timeout = 7000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "WHSF-AI-Career-Connect/1.0 (+https://whsf-website.vercel.app)" }
    });
  } finally {
    clearTimeout(timer);
  }
};

const cleanText = (value = "") => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&#8217;|&rsquo;/gi, "'")
  .replace(/\s+/g, " ")
  .trim();

const findApplicationStatus = (html) => {
  const text = cleanText(html);
  const match = text.match(/applications?[^.]{0,180}\b(open|closed)\b[^.]{0,100}\./i)
    || text.match(/\b(open|closed)\b[^.]{0,100}applications?[^.]{0,80}\./i);
  return match ? match[0].slice(0, 220) : "Review the official page for the current application window.";
};

const fetchOfficialProgramme = async (programme) => {
  try {
    const response = await fetchWithTimeout(programme.url);
    if (!response.ok) throw new Error(`Source returned ${response.status}`);
    const html = await response.text();
    return {
      ...programme,
      tag: programme.tag || "Official source",
      sourceStatus: "Live",
      applicationStatus: programme.kind === "conference" ? undefined : findApplicationStatus(html),
      sourceUpdatedAt: response.headers.get("last-modified") || null
    };
  } catch {
    return {
      ...programme,
      tag: programme.tag || "Official source",
      sourceStatus: "Link available",
      applicationStatus: programme.kind === "conference" ? undefined : "Open the official page to confirm the current application window.",
      sourceUpdatedAt: null
    };
  }
};

const fetchJobBoard = async ([token, organisation], type) => {
  const response = await fetchWithTimeout(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`);
  if (!response.ok) throw new Error(`${organisation} returned ${response.status}`);
  const payload = await response.json();
  const pattern = type === "internships" ? INTERNSHIP_PATTERN : REMOTE_PATTERN;
  return (payload.jobs || [])
    .filter((job) => pattern.test(`${job.title || ""} ${type === "remote" ? job.location?.name || "" : ""}`))
    .map((job) => ({
      id: `${token}-${job.id}`,
      title: job.title,
      organisation,
      location: job.location?.name || (type === "remote" ? "Remote" : "Location on posting"),
      summary: type === "internships"
        ? "Published internship, student, trainee or graduate opportunity."
        : "Published role identified by the employer as remote, distributed or home-based.",
      url: job.absolute_url,
      tag: type === "internships" ? "Internship / early career" : "Remote role",
      sourceStatus: "Live employer posting",
      sourceUpdatedAt: job.updated_at || null
    }));
};

const fetchJobs = async (type) => {
  const results = await Promise.allSettled(JOB_BOARDS[type].map((board) => fetchJobBoard(board, type)));
  const unique = new Map();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((job) => {
      if (job.url && !unique.has(job.url)) unique.set(job.url, job);
    });
  });
  return [...unique.values()]
    .sort((a, b) => new Date(b.sourceUpdatedAt || 0) - new Date(a.sourceUpdatedAt || 0))
    .slice(0, 10);
};

module.exports = async (request, response) => {
  const type = String(request.query?.type || "scholarships").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    return response.status(400).json({ error: "Choose scholarships, internships, remote, exchange or conferences." });
  }

  try {
    const items = OFFICIAL_PROGRAMMES[type]
      ? await Promise.all(OFFICIAL_PROGRAMMES[type].map(fetchOfficialProgramme))
      : await fetchJobs(type);

    if (!items.length) {
      return response.status(503).json({ error: "No live results are available from the selected sources right now." });
    }

    response.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return response.status(200).json({
      type,
      fetchedAt: new Date().toISOString(),
      sourceKind: OFFICIAL_PROGRAMMES[type] ? "official programme websites" : "employer job boards",
      items
    });
  } catch (error) {
    console.error("Opportunity fetch failed", { type, message: error.message });
    return response.status(502).json({ error: "Live sources could not be reached. Please try again shortly." });
  }
};
