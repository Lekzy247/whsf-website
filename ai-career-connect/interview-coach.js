(() => {
  const historyKey = "whsf-aicc-interview-history-v1";
  const byId = (id) => document.getElementById(id);
  const questionBank = {
    behavioural: [
      "Tell me about a time you solved a difficult problem with limited information.",
      "Describe a situation where you had to work with someone whose approach differed from yours.",
      "Give an example of a goal you achieved and how you measured success.",
      "Tell me about a mistake or setback and what you changed afterwards.",
      "Describe a time you took initiative beyond your formal responsibilities.",
      "Tell me about a time you managed competing priorities under pressure."
    ],
    motivation: [
      "Why does this role fit the direction you want your career to take?",
      "What kind of team environment helps you do your best work?",
      "Which professional achievement are you most proud of, and why?",
      "What would you aim to learn in your first 90 days?",
      "How do your values influence the way you work with others?",
      "Why should we choose you for this opportunity?"
    ],
    technical: {
      data: [
        "Walk me through how you would validate a dataset before using it for a decision.",
        "How would you explain a complex analysis to a non-technical stakeholder?",
        "Describe a dashboard or analysis you created and the decision it supported.",
        "What would you do if two data sources produced conflicting results?",
        "How do you choose the right metric for a business or programme objective?"
      ],
      programme: [
        "How would you turn a programme objective into an implementation plan?",
        "Describe how you would monitor progress and manage a delivery risk.",
        "How would you respond when a partner misses an important deadline?",
        "Which indicators would you use to evaluate programme impact?",
        "How do you keep stakeholders informed without overwhelming them?"
      ],
      healthcare: [
        "How do you maintain quality and safety when working under pressure?",
        "Describe how you would communicate difficult information with empathy.",
        "How do you protect confidentiality when collaborating across a care team?",
        "Tell me how you prioritise when several people need support at once.",
        "How would you respond to a disagreement about a care decision?"
      ],
      software: [
        "How do you investigate a production issue you cannot reproduce locally?",
        "Explain how you balance delivery speed with code quality.",
        "Describe a technical decision you made and the trade-offs involved.",
        "How would you make an unfamiliar codebase safer to change?",
        "Tell me about a time testing changed your implementation approach."
      ],
      communications: [
        "How would you adapt one message for different audiences and channels?",
        "Describe a campaign or piece of content that produced a measurable result.",
        "How do you respond when performance data challenges your creative approach?",
        "How would you communicate during a fast-moving reputational issue?",
        "Which metrics would you use to evaluate audience engagement?"
      ],
      graduate: [
        "How have your studies or projects prepared you to contribute in this role?",
        "Tell me about a group assignment and the contribution you personally made.",
        "How do you approach a task when you have never done it before?",
        "Describe a time you used feedback to improve your work.",
        "Which transferable skill would help you add value quickly?"
      ]
    }
  };
  const roleLabels = { data: "Data or Business Analyst", programme: "Programme Coordinator", healthcare: "Healthcare Professional", software: "Software Developer", communications: "Communications & Marketing", graduate: "Graduate / Entry Level" };
  const actionWords = ["led", "created", "delivered", "analysed", "improved", "designed", "implemented", "resolved", "increased", "reduced", "coordinated", "built"];
  let session = { questions: [], index: 0, scores: [], startedAt: null, timerId: null };

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

  const loadHistory = () => {
    try {
      const history = JSON.parse(localStorage.getItem(historyKey)) || { completed: 0, best: 0 };
      byId("completed-count").textContent = `${history.completed || 0} questions`;
      byId("best-score").textContent = history.best ? `${history.best}/100` : "—";
    } catch {
      localStorage.removeItem(historyKey);
    }
  };

  const selectQuestions = () => {
    const type = byId("interview-type").value;
    const role = byId("role").value;
    const primary = type === "technical" ? questionBank.technical[role] : questionBank[type];
    const secondary = type === "technical" ? questionBank.behavioural : questionBank.technical[role];
    return [...primary, ...secondary].sort(() => Math.random() - .5).slice(0, 5);
  };

  const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const startTimer = () => {
    clearInterval(session.timerId);
    session.startedAt = Date.now();
    byId("timer").textContent = "00:00";
    session.timerId = setInterval(() => {
      byId("timer").textContent = formatTime(Math.floor((Date.now() - session.startedAt) / 1000));
    }, 1000);
  };

  const renderQuestion = () => {
    const type = byId("interview-type").selectedOptions[0].textContent;
    byId("session-label").textContent = `${roleLabels[byId("role").value]} • ${type}`;
    byId("question-number").textContent = session.index + 1;
    byId("question-progress").style.width = `${((session.index + 1) / 5) * 100}%`;
    byId("question-type").textContent = `${byId("difficulty").selectedOptions[0].textContent} ${type}`;
    byId("question-text").textContent = session.questions[session.index];
    byId("answer").value = "";
    byId("word-count").textContent = "0";
    byId("feedback-card").hidden = true;
    byId("session-complete").hidden = true;
    byId("answer-area").hidden = false;
    byId("get-feedback").hidden = false;
    byId("next-question").hidden = true;
    byId("answer").disabled = false;
    byId("answer").focus();
    startTimer();
  };

  const startSession = () => {
    session.questions = selectQuestions();
    session.index = 0;
    session.scores = [];
    byId("coach-empty").hidden = true;
    byId("coach-session").hidden = false;
    byId("restart-session").hidden = false;
    renderQuestion();
  };

  const feedbackFor = (answer) => {
    const words = answer.trim().split(/\s+/).filter(Boolean);
    const lower = answer.toLowerCase();
    const hasSituation = /\b(situation|context|when|while)\b/.test(lower);
    const hasAction = /\b(i|my)\b/.test(lower) && actionWords.some((word) => lower.includes(word));
    const hasResult = /\b(result|outcome|impact|improved|increased|reduced|achieved|learned)\b/.test(lower);
    const hasEvidence = /\d|%|percent|days|weeks|months|people|users|clients|patients/.test(lower);
    const idealLength = words.length >= 80 && words.length <= 220;
    let score = 28;
    score += hasSituation ? 13 : 0;
    score += hasAction ? 18 : 0;
    score += hasResult ? 17 : 0;
    score += hasEvidence ? 14 : 0;
    score += idealLength ? 10 : Math.min(8, Math.floor(words.length / 20));
    score = Math.min(100, score);
    return {
      score,
      summary: score >= 85 ? "Strong, evidence-led answer. Keep the same focus in the real interview." : score >= 68 ? "A solid answer. One more specific result would make it stronger." : "A useful starting point. Add clearer actions and measurable results.",
      structure: hasSituation && hasAction && hasResult ? "Your answer has a clear situation, action and result." : "Use clear Situation, Task, Action and Result signals.",
      evidence: hasEvidence ? "You included concrete evidence or a measurable detail." : "Add a number, outcome or observable change.",
      ownership: hasAction ? "Your personal contribution is clear." : "Use “I” and a strong action verb to show what you did.",
      clarity: idealLength ? "The length is focused and interview-ready." : words.length < 80 ? "Develop the answer to at least 80 words." : "Tighten the answer toward 220 words or fewer."
    };
  };

  const recordScore = (score) => {
    let history = { completed: 0, best: 0 };
    try { history = JSON.parse(localStorage.getItem(historyKey)) || history; } catch { /* use defaults */ }
    history.completed += 1;
    history.best = Math.max(history.best || 0, score);
    localStorage.setItem(historyKey, JSON.stringify(history));
    loadHistory();
  };

  const showFeedback = () => {
    const answer = byId("answer").value.trim();
    if (answer.split(/\s+/).filter(Boolean).length < 20) {
      byId("answer").setAttribute("aria-invalid", "true");
      byId("coach-tip").textContent = "Write at least 20 words so the coach has enough detail to assess.";
      byId("answer").focus();
      return;
    }
    byId("answer").removeAttribute("aria-invalid");
    const feedback = feedbackFor(answer);
    session.scores.push(feedback.score);
    recordScore(feedback.score);
    byId("feedback-score").textContent = feedback.score;
    byId("feedback-summary").textContent = feedback.summary;
    byId("feedback-structure").textContent = feedback.structure;
    byId("feedback-evidence").textContent = feedback.evidence;
    byId("feedback-ownership").textContent = feedback.ownership;
    byId("feedback-clarity").textContent = feedback.clarity;
    byId("feedback-card").hidden = false;
    byId("get-feedback").hidden = true;
    byId("next-question").hidden = false;
    byId("next-question").textContent = session.index === 4 ? "Complete session →" : "Next question →";
    byId("answer").disabled = true;
    clearInterval(session.timerId);
  };

  const nextQuestion = () => {
    if (session.index < 4) {
      session.index += 1;
      renderQuestion();
      return;
    }
    clearInterval(session.timerId);
    const average = Math.round(session.scores.reduce((sum, score) => sum + score, 0) / session.scores.length);
    byId("feedback-card").hidden = true;
    byId("get-feedback").hidden = true;
    byId("next-question").hidden = true;
    byId("answer-area").hidden = true;
    byId("question-text").textContent = "You completed this practice session.";
    byId("session-score").textContent = average;
    byId("session-complete").hidden = false;
  };

  byId("answer").addEventListener("input", () => {
    const count = byId("answer").value.trim().split(/\s+/).filter(Boolean).length;
    byId("word-count").textContent = count;
    byId("answer").removeAttribute("aria-invalid");
  });
  byId("start-session").addEventListener("click", startSession);
  byId("empty-start").addEventListener("click", startSession);
  byId("restart-session").addEventListener("click", startSession);
  byId("complete-restart").addEventListener("click", startSession);
  byId("get-feedback").addEventListener("click", showFeedback);
  byId("next-question").addEventListener("click", nextQuestion);

  setupNavigation();
  loadHistory();
})();
