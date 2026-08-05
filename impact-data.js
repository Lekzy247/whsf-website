window.WHSF_IMPACT_DATA = {
  meta: {
    publicationDate: "2026-08-04",
    scope: "Published WHSF website programme records",
    note: "Headline totals may overlap across programmes and locations. They must not be added together unless WHSF publishes a deduplicated total."
  },
  metrics: [
    { id: "girls", value: 7500, display: "7,500+", label: "Girls impacted", programme: "girls-in-ict", region: "africa", year: "since-2015", note: "Through WHSF technology and education programmes since 2015." },
    { id: "women", value: 550, display: "550+", label: "Young women empowered", programme: "career-pathways", region: "global", year: "since-2015", note: "Through entrepreneurship, mentorship, networking and job-opportunity pathways worldwide." },
    { id: "enrolments", value: 1200, display: "1,200", label: "Course enrolments", programme: "digital-learning", region: "global", year: "current", note: "Enrolments recorded across WHSF e-learning pathways." },
    { id: "assignments", value: 1137, display: "1,137", label: "Assignments submitted", programme: "digital-learning", region: "global", year: "current", note: "A participation indicator across WHSF learning pathways." },
    { id: "certificates", value: 950, display: "950", label: "Certificates issued", programme: "digital-learning", region: "global", year: "current", note: "Certificates supporting skills recognition." },
    { id: "tracks", value: 12, display: "12", label: "Learning tracks", programme: "digital-learning", region: "global", year: "current", note: "Published technology and professional learning pathways." }
  ],
  locations: [
    {
      id: "nigeria",
      name: "Nigeria",
      region: "africa",
      lat: 9.08,
      lng: 8.68,
      programmes: ["girls-in-ict", "robotics-drones", "agrismart-ai"],
      beneficiaries: "Included within the published 7,500+ aggregate",
      summary: "Technology education, Girls in ICT, robotics, drones and climate-smart learning."
    },
    {
      id: "africa-regional",
      name: "Regional Africa",
      region: "africa",
      lat: 1.8,
      lng: 25.0,
      programmes: ["girls-in-ict", "robotics-drones"],
      beneficiaries: "Regional delivery included in aggregate totals",
      summary: "WHSF records describe programme reach in Nigeria and other African countries without a published country-by-country breakdown."
    },
    {
      id: "global-online",
      name: "Global and online",
      region: "global",
      lat: 28.0,
      lng: -32.0,
      programmes: ["career-pathways", "digital-learning"],
      beneficiaries: "550+ young women; 1,200 course enrolments",
      summary: "Online learning, mentorship, networking and career pathways available across borders."
    }
  ],
  programmes: {
    "girls-in-ict": {
      title: "Girls in ICT Club & TechWomen",
      shortTitle: "Girls in ICT",
      eyebrow: "Digital inclusion",
      summary: "Safe learning spaces, practical digital literacy, mentorship and pathways into technology for girls and young women.",
      image: "assets/programs/ict-girls-club-certificates.jpg",
      imageAlt: "Girls in ICT Club learners celebrating WHSF certificates",
      metricIds: ["girls", "women"],
      regions: ["Nigeria", "Regional Africa", "Global pathways"],
      outcomes: [
        "Greater access to practical technology education",
        "Improved digital confidence and skills recognition",
        "Mentorship, networking and career exposure"
      ],
      indicators: ["Participants enrolled", "Completion and certificate rate", "Mentorship participation", "Education or career progression"],
      url: "programme-girls-in-ict.html"
    },
    "robotics-drones": {
      title: "Robotics & Drone Technology",
      shortTitle: "Robotics & Drones",
      eyebrow: "Hands-on STEM",
      summary: "Practical robotics and drone activities that make engineering, automation and problem-solving visible and achievable.",
      image: "assets/gallery/project-17.jpg",
      imageAlt: "Drone technology programme for girls and communities",
      metricIds: ["girls"],
      regions: ["Nigeria", "Regional Africa"],
      outcomes: [
        "Hands-on exposure to robotics and drone technology",
        "Stronger STEM curiosity and problem-solving confidence",
        "Educational re-engagement for underserved learners"
      ],
      indicators: ["Learners completing practical sessions", "Devices and learning kits used", "Schools and communities reached", "Learners returning to education"],
      url: "programme-robotics-drones.html"
    },
    "agrismart-ai": {
      title: "AgriSmart AI",
      shortTitle: "AgriSmart AI",
      eyebrow: "Climate-smart innovation",
      summary: "A gender-responsive programme connecting girls aged 12–24 with climate-smart agriculture, sustainability and applied technology.",
      image: "assets/programs/agrismart-ai-programme.png",
      imageAlt: "Agricultural analytics beside a healthy climate-smart crop",
      metricIds: [],
      regions: ["Rural Nigeria", "Peri-urban Nigeria"],
      outcomes: [
        "Practical awareness of climate-smart agriculture",
        "Confidence using digital tools for agricultural learning",
        "Stronger links between sustainability and livelihoods"
      ],
      indicators: ["Learners aged 12–24 enrolled", "Training sessions completed", "Climate-smart demonstrations delivered", "Participant projects or livelihood applications"],
      url: "programme-agrismart-ai.html"
    },
    "career-pathways": {
      title: "AI Career Connect",
      shortTitle: "AI Career Connect",
      eyebrow: "Skills and opportunity",
      summary: "AI-supported education, career guidance, mentorship and opportunity pathways for learners and professionals.",
      image: "assets/programs/ai-career-connect-programme.png",
      imageAlt: "Network connecting education, mentorship, skills and opportunities",
      metricIds: ["women"],
      regions: ["Global", "Online"],
      outcomes: [
        "Improved access to career information and mentorship",
        "Job-ready skills and professional development",
        "Connections to education and opportunity pathways"
      ],
      indicators: ["Learner profiles created", "Mentorship matches", "Courses completed", "Interviews, placements or education transitions"],
      url: "programme-ai-career-connect.html"
    }
  }
};