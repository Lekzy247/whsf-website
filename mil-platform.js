(() => {
  const topicScopes = {
    mil: 'site:unesco.org OR site:unesco.org/mil4teachers',
    ai: 'site:unesco.org OR site:skillsbuild.org OR site:oecd.ai',
    journalism: 'site:unesco.org OR site:reutersinstitute.politics.ox.ac.uk',
    factcheck: 'site:toolbox.google.com/factcheck OR site:factcheck.org OR site:africacheck.org',
    cyber: 'site:skillsforall.com OR site:cisa.gov OR site:staysafeonline.org',
    innovation: 'site:unicef.org/innovation OR site:undp.org',
    gender: 'site:unwomen.org OR site:itu.int',
    policy: 'site:oecd.ai OR site:unesco.org OR site:itu.int'
  };

  const topicNames = {
    mil: 'media and information literacy',
    ai: 'responsible artificial intelligence',
    journalism: 'digital journalism',
    factcheck: 'fact-checking and verification',
    cyber: 'cyber safety',
    innovation: 'youth innovation',
    gender: 'women’s digital leadership',
    policy: 'digital research and policy'
  };

  const trackedKey = 'whsf-mil-explored';
  const planKey = 'whsf-mil-plan';

  function readTracked() {
    try { return JSON.parse(localStorage.getItem(trackedKey) || '[]'); }
    catch (_) { return []; }
  }

  function updateProgress() {
    const count = document.querySelector('#mil-progress-count');
    if (count) count.textContent = String(new Set(readTracked()).size);
  }

  function track(label) {
    const items = new Set(readTracked());
    items.add(label);
    localStorage.setItem(trackedKey, JSON.stringify(Array.from(items)));
    updateProgress();
  }

  function trustedSearch(query, topic) {
    const scope = topicScopes[topic] || topicScopes.mil;
    const url = 'https://www.google.com/search?q=' + encodeURIComponent(query + ' (' + scope + ')');
    window.open(url, '_blank', 'noopener,noreferrer');
    track('Trusted research: ' + topic);
  }

  document.querySelectorAll('[data-mil-track]').forEach((item) => {
    item.addEventListener('click', () => track(item.dataset.milTrack || 'MIL activity'));
  });

  document.querySelectorAll('[data-mil-search]').forEach((button) => {
    button.addEventListener('click', () => trustedSearch(button.dataset.milSearch || 'media information literacy', button.dataset.milTopic || 'mil'));
  });

  const researchForm = document.querySelector('#mil-research-form');
  const queryField = document.querySelector('#mil-research-query');
  const topicField = document.querySelector('#mil-research-topic');
  const briefPanel = document.querySelector('#mil-brief-panel');
  const briefText = document.querySelector('#mil-brief-text');

  researchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!queryField.reportValidity()) return;
    trustedSearch(queryField.value.trim(), topicField.value);
  });

  document.querySelector('#mil-build-brief')?.addEventListener('click', () => {
    if (!queryField.reportValidity()) return;
    const topic = topicNames[topicField.value] || topicNames.mil;
    const prompt = 'Research this question using current internet sources: “' + queryField.value.trim() + '”\n\nFocus area: ' + topic + '. Use at least three credible and independent sources, prioritise original organisations and recent publications, show publication dates, distinguish facts from opinion, identify uncertainty or conflicting evidence, and provide direct source links. End with five practical actions suitable for a WHSF community learner.';
    briefText.textContent = prompt;
    briefPanel.hidden = false;
    track('AI research brief');
  });

  document.querySelector('#mil-copy-brief')?.addEventListener('click', async () => {
    const status = document.querySelector('#mil-copy-status');
    try {
      await navigator.clipboard.writeText(briefText.textContent);
      status.textContent = 'Copied';
    } catch (_) {
      status.textContent = 'Select and copy the brief above';
    }
  });

  const planMap = {
    verify: [
      ['Learn verification fundamentals', 'https://www.unesco.org/en/media-information-literacy/resources'],
      ['Practise checking a live claim', 'https://toolbox.google.com/factcheck/explorer'],
      ['Create a trusted-information project', 'contact.html']
    ],
    ai: [
      ['Complete an AI fundamentals course', 'https://skillsbuild.org/adult-learners/explore-learning/artificial-intelligence'],
      ['Review responsible AI policy evidence', 'https://oecd.ai/en/'],
      ['Build an ethical community use case', 'contact.html']
    ],
    create: [
      ['Study trusted storytelling', 'https://www.unesco.org/en/media-information-literacy/resources'],
      ['Learn podcast or media production', 'https://creators.spotify.com/resources'],
      ['Publish a portfolio project', 'student-projects.html']
    ],
    safe: [
      ['Start a cyber safety course', 'https://www.skillsforall.com/catalog?category=course&subject+areas=cybersecurity'],
      ['Run a personal privacy and password review', '#trusted-research'],
      ['Share a community cyber-safety lesson', 'contact.html']
    ],
    impact: [
      ['Explore youth innovation models', 'https://www.unicef.org/innovation/'],
      ['Define a measurable community challenge', '#trusted-research'],
      ['Submit your community project', 'contact.html']
    ]
  };

  const pathForm = document.querySelector('#mil-path-form');
  const pathResult = document.querySelector('#mil-path-result');

  function renderPlan(role, goal) {
    const steps = planMap[goal] || planMap.verify;
    const roleLabel = document.querySelector('#mil-role option:checked')?.textContent || role;
    pathResult.innerHTML = '<strong>' + roleLabel + ' pathway</strong><ol>' + steps.map((step) => '<li><a href="' + step[1] + '"' + (step[1].startsWith('http') ? ' target="_blank" rel="noreferrer"' : '') + '>' + step[0] + ' →</a></li>').join('') + '</ol>';
  }

  pathForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const role = document.querySelector('#mil-role').value;
    const goal = document.querySelector('#mil-goal').value;
    localStorage.setItem(planKey, JSON.stringify({ role, goal }));
    renderPlan(role, goal);
    track('Personal MIL pathway');
  });

  try {
    const saved = JSON.parse(localStorage.getItem(planKey) || 'null');
    if (saved) {
      document.querySelector('#mil-role').value = saved.role;
      document.querySelector('#mil-goal').value = saved.goal;
      renderPlan(saved.role, saved.goal);
    }
  } catch (_) {}

  updateProgress();
})();