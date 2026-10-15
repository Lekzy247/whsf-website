// WHSF Forum add-on: MIL Lab community (#mil/<checks|ask|learn|review>, #mil/check/<id>).
// Members ask for a fact-check of a claim they saw; WHSF-appointed fact-checkers answer with a verdict and
// sources; answered checks form a searchable library. Members work through the six MIL Lab modules (short
// lesson + one exercise each); finishing all six earns the MIL Ambassador badge on their profile.
// Every rule is enforced by the database (forum_factcheck_* functions and RLS).
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar } = F;
  const VERDICTS = {
    true: ['True', 'The claim is accurate.'],
    false: ['False', 'The claim is wrong.'],
    misleading: ['Misleading', 'Partly true but presented in a way that misleads.'],
    missing_context: ['Missing context', 'Accurate on its own but leaves out facts that change the meaning.'],
    unproven: ['Unproven', 'There is not enough reliable evidence either way.']
  };
  const TOPICS = { health: 'Health', elections: 'Elections & politics', scam: 'Scams & money', education: 'Education', climate: 'Climate & environment', conflict: 'Conflict & crisis', ai_media: 'AI & deepfakes', other: 'Other' };
  const SEEN = { whatsapp: 'WhatsApp', facebook: 'Facebook', x: 'X (Twitter)', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', website: 'A website', tv_radio: 'TV or radio', in_person: 'In person', other: 'Somewhere else' };
  const STATUS = { open: 'Waiting for a fact-checker', in_review: 'Being checked', answered: 'Answered', rejected: 'Closed' };
  const MODULES = [
    { n: 1, title: 'MIL fundamentals', lead: 'How media and information work, and how to access, analyse and evaluate them.',
      points: ['Every message is made by someone, for a reason. Ask who made it, why, and who benefits if you believe or share it.',
        'Separate news, opinion, advertising and entertainment. They follow different rules and are often mixed together on social media.',
        'Check the source behind the source: an article is only as reliable as the evidence and experts it is based on.'],
      quiz: { q: 'A post says “Doctors don’t want you to know this”. What is the best first question to ask?', a: ['Who made this post, and what do they gain if I share it?', 'How many likes does it have?', 'Is the picture high quality?'], ok: 0,
        why: 'Popularity and polish say nothing about accuracy. Start with the author and their purpose.' } },
    { n: 2, title: 'Detecting misinformation', lead: 'Misinformation, disinformation, scams and online manipulation tactics.',
      points: ['Misinformation is false but shared in good faith; disinformation is false and shared on purpose; malinformation is true but used to harm.',
        'Warning signs: strong emotion (fear, anger), urgency (“share before it’s deleted”), no named source, and offers that are too good to be true.',
        'Scams often copy real organisations. Go to the official website yourself instead of following the link you were sent.'],
      quiz: { q: 'A WhatsApp message says a government grant will pay you $500 if you forward it to 10 people and enter your bank details. What is it most likely to be?', a: ['A scam', 'A real grant', 'A government survey'], ok: 0,
        why: 'Real grants never ask you to forward messages or share bank details through a link. Urgency plus a reward is a classic scam pattern.' } },
    { n: 3, title: 'Responsible AI', lead: 'AI opportunities, risks and ethics, and how to spot AI-generated content.',
      points: ['AI tools can save time and widen access to knowledge, but they can also invent facts (“hallucinate”) that sound confident.',
        'Signs of AI images and video: odd hands, text that does not read properly, mismatched shadows, and lips that do not match the sound.',
        'Use AI openly and ethically: check its facts, do not present AI work as your own, and never create fake content about real people.'],
      quiz: { q: 'An AI chatbot gives you a statistic for your report. What should you do?', a: ['Find the original source of the statistic before using it', 'Use it, AI is always right', 'Round it up so it looks better'], ok: 0,
        why: 'AI tools can invent numbers and references. Always trace a fact back to a reliable original source.' } },
    { n: 4, title: 'Fact-checking', lead: 'Practical verification of claims, images, videos and sources.',
      points: ['Read laterally: open new tabs and see what trusted sources say about the claim and the site, instead of staying on the page.',
        'Use a reverse image search to find where a photo first appeared; old photos are often reused for new events.',
        'Look for the original: the full speech, the study, the official statement. Quotes and screenshots are easy to cut or fake.'],
      quiz: { q: 'A dramatic photo is shared as “today’s flood”. What is the quickest way to check it?', a: ['Do a reverse image search to see when it first appeared', 'Zoom in on the photo', 'Ask the person who shared it if it’s real'], ok: 0,
        why: 'A reverse image search often shows the photo is years old or from another country.' } },
    { n: 5, title: 'Ethical content creation', lead: 'Digital storytelling and media production for social good.',
      points: ['Get consent before filming or posting people, and take extra care with children and people in vulnerable situations.',
        'Credit your sources and creators. Use images and music you have the right to use.',
        'Tell true stories with dignity: avoid stereotypes, show people as more than their hardship, and correct mistakes openly.'],
      quiz: { q: 'You want to post a video from a community event that shows children’s faces. What should you do first?', a: ['Get permission from their parents or guardians', 'Post it, it was a public event', 'Add a filter so it looks nicer'], ok: 0,
        why: 'Children’s images need consent from a parent or guardian, even at public events.' } },
    { n: 6, title: 'Youth leadership', lead: 'Leading peer education and community awareness as an MIL Ambassador.',
      points: ['Lead by example: pause before sharing, and correct false information kindly without shaming people.',
        'Run short sessions with friends, family or your school: show one real example and one checking tool.',
        'Keep learning together: share fact-checks here, ask for help when you are unsure, and support newer members.'],
      quiz: { q: 'A relative shares a false health claim in the family group. What is the most helpful response?', a: ['Reply kindly with a reliable source and explain how you checked', 'Call them foolish in the group', 'Ignore it, it doesn’t matter'], ok: 0,
        why: 'A respectful correction with a source helps people change their mind without feeling attacked.' } }
  ];
  const status = () => el('p', { class: 'fm-status', role: 'status' });
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const httpsLink = (url, text) => (/^https:\/\/\S+$/.test(url || '') ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer nofollow', text }) : el('span', { text }));
  const field = (label, input, hint) => el('label', {}, [label, hint ? el('small', { text: ` ${hint}` }) : null, input].filter(Boolean));
  const select = (opts, first) => el('select', {}, [first ? el('option', { value: '', text: first }) : null, ...Object.entries(opts).map(([k, t]) => el('option', { value: k, text: t }))].filter(Boolean));
  let checker = null;

  async function isChecker() {
    if (checker !== null) return checker;
    const { data } = await db.rpc('forum_is_factchecker');
    checker = Boolean(data);
    return checker;
  }

  async function render() {
    const box = $('[data-fm-mil]');
    if (!box || !state.me) return;
    const parts = location.hash.slice(1).split('/');
    const single = parts[1] === 'check' && /^[0-9a-f-]{36}$/.test(parts[2] || '') ? parts[2] : null;
    const canReview = await isChecker();
    const tabs = [['checks', 'Fact-checks'], ['ask', 'Ask for a fact-check'], ['learn', 'Learn'], ...(canReview ? [['review', 'Review']] : [])];
    const tab = single ? 'checks' : tabs.some(([k]) => k === parts[1]) ? parts[1] : 'checks';
    const body = el('div', { class: 'fm-mil-body' }, [el('p', { class: 'fm-muted', text: 'Loading…' })]);
    box.replaceChildren(
      el('div', { class: 'fm-fund-head' }, [el('div', {}, [
        el('h2', { text: 'MIL Lab community' }),
        el('p', { class: 'fm-muted' }, ['Spot, verify, create, amplify. Ask WHSF fact-checkers about a claim, learn the six MIL Lab modules and become an MIL Ambassador. ',
          el('a', { href: 'mil-lab.html', text: 'About the MIL Lab →' })])
      ])]),
      el('nav', { class: 'fm-admin-tabs', 'aria-label': 'MIL Lab' }, tabs.map(([k, t]) => { const a = el('a', { href: `#mil/${k}`, class: `fm-admin-tab${k === tab ? ' is-on' : ''}`, text: t }); if (k === tab) a.setAttribute('aria-current', 'page'); return a; })),
      body
    );
    if (single) return one(body, single);
    if (tab === 'ask') return ask(body);
    if (tab === 'learn') return learn(body);
    if (tab === 'review') return review(body);
    return library(body);
  }

  // ---------------------------------------------------------------- shared card
  function verdictBadge(v) {
    return el('span', { class: `fm-verdict is-${v}`, title: VERDICTS[v]?.[1] || '', text: VERDICTS[v]?.[0] || v });
  }
  function checkCard(c, { full = false } = {}) {
    const msg = status();
    const share = el('button', { type: 'button', class: 'fm-text-btn', text: '🔗 Copy link', onclick: async () => {
      const url = `${location.origin}${location.pathname}#mil/check/${c.id}`;
      try { await navigator.clipboard.writeText(url); msg.textContent = 'Link copied. Share it where the claim is spreading.'; } catch { msg.textContent = url; }
    } });
    return el('article', { class: 'fm-check-card' }, [
      el('div', { class: 'fm-check-head' }, [
        c.verdict ? verdictBadge(c.verdict) : el('span', { class: `fm-app-status is-${c.status === 'rejected' ? 'withdrawn' : 'reviewing'}`, text: STATUS[c.status] }),
        el('span', { class: 'fm-small fm-muted', text: [TOPICS[c.topic], c.seen_on ? `Seen on ${SEEN[c.seen_on]}` : null].filter(Boolean).join(' · ') })
      ]),
      el('p', { class: 'fm-check-claim' }, [el('span', { class: 'fm-check-label', text: 'Claim' }), c.claim]),
      c.summary ? el('p', { class: 'fm-check-summary', text: full ? c.summary : (c.summary.length > 280 ? `${c.summary.slice(0, 280)}…` : c.summary) }) : null,
      c.status === 'rejected' && c.reject_reason ? el('p', { class: 'fm-small fm-muted', text: `Not checked: ${c.reject_reason}` }) : null,
      full && c.source_url ? el('p', { class: 'fm-small fm-muted' }, ['Where it was shared: ', httpsLink(c.source_url, c.source_url)]) : null,
      (full || c.verdict) && Array.isArray(c.sources) && c.sources.length ? el('div', { class: 'fm-check-sources' }, [
        el('strong', { text: 'Sources' }),
        el('ol', {}, c.sources.map((s) => el('li', {}, [httpsLink(s.url, s.title)])))
      ]) : null,
      el('div', { class: 'fm-check-foot' }, [
        el('span', { class: 'fm-small fm-muted', text: c.answered_at && c.status === 'answered' ? `Checked ${day(c.answered_at)}` : `Asked ${day(c.created_at)}` }),
        full ? null : el('a', { class: 'fm-text-btn', href: `#mil/check/${c.id}`, text: 'Read more' }),
        c.status === 'answered' ? share : null
      ].filter(Boolean)),
      msg
    ].filter(Boolean));
  }

  // ---------------------------------------------------------------- library
  async function library(body, q = '', topic = '', verdict = '') {
    const search = el('input', { type: 'search', placeholder: 'Search fact-checks (e.g. malaria, grant, election)', 'aria-label': 'Search fact-checks', maxlength: '60', value: q });
    const chips = (opts, cur, set) => el('div', { class: 'fm-chips' }, [['', 'All'], ...Object.entries(opts).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])].map(([k, t]) => el('button', {
      type: 'button', class: `fm-chip-btn${k === cur ? ' is-on' : ''}`, text: t, onclick: () => set(k)
    })));
    const list = el('div', { class: 'fm-check-list' }, [el('p', { class: 'fm-muted', text: 'Loading fact-checks…' })]);
    body.replaceChildren(
      el('div', { class: 'fm-mil-cta' }, [
        el('p', {}, [el('strong', { text: 'Not sure if something is true? ' }), 'Ask before you share. A WHSF fact-checker will look into it.']),
        el('a', { class: 'hp-btn hp-btn-primary', href: '#mil/ask', text: 'Ask for a fact-check' })
      ]),
      search,
      chips(TOPICS, topic, (k) => library(body, search.value.trim(), k, verdict)),
      chips(VERDICTS, verdict, (k) => library(body, search.value.trim(), topic, k)),
      list
    );
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => library(body, search.value.trim(), topic, verdict).then(() => { const s = body.querySelector('input[type=search]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }), 400); });
    let query = db.from('forum_factchecks').select('id,claim,topic,seen_on,status,verdict,summary,sources,answered_at,created_at').eq('status', 'answered').order('answered_at', { ascending: false }).limit(60);
    const term = q.replace(/[%_,()\\]/g, ' ').trim();
    if (term) query = query.ilike('claim', `%${term}%`);
    if (topic) query = query.eq('topic', topic);
    if (verdict) query = query.eq('verdict', verdict);
    const { data, error } = await query;
    if (error) { list.replaceChildren(el('p', { class: 'fm-muted', text: 'Fact-checks could not be loaded.' })); return; }
    list.replaceChildren(...(data?.length ? data.map((c) => checkCard(c)) : [el('div', { class: 'fm-empty' }, [term || topic || verdict ? 'No fact-checks match.' : 'No fact-checks yet. Be the first to ask: ', el('a', { href: '#mil/ask', text: 'Ask for a fact-check →' })])]));
  }

  async function one(body, id) {
    const { data: c } = await db.from('forum_factchecks').select('*').eq('id', id).maybeSingle();
    if (!c) { body.replaceChildren(el('p', { text: 'This fact-check is not available.' }), el('a', { class: 'fm-text-btn', href: '#mil', text: '← All fact-checks' })); return; }
    const kids = [el('a', { class: 'fm-text-btn', href: '#mil', text: '← All fact-checks' }), checkCard(c, { full: true })];
    if (c.checker_id && c.status === 'answered') {
      const { data: p } = await db.from('forum_profiles').select('user_id,display_name,headline,avatar_url').eq('user_id', c.checker_id).maybeSingle();
      if (p) {
        const av = el('div', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' }); fillAvatar(av, p);
        kids.push(el('a', { class: 'fm-net-who fm-check-by', href: `#profile/${p.user_id}` }, [av, el('span', {}, [el('strong', { text: p.display_name }), el('small', { text: 'WHSF fact-checker' })])]));
      }
    }
    if (c.verdict) kids.push(el('p', { class: 'fm-small fm-muted', text: `${VERDICTS[c.verdict][0]}: ${VERDICTS[c.verdict][1]} Fact-checks are written by trained WHSF volunteers. If you have evidence we missed, message the fact-checker.` }));
    body.replaceChildren(...kids);
  }

  // ---------------------------------------------------------------- ask
  async function ask(body) {
    const msg = status();
    const claim = el('textarea', { rows: '4', maxlength: '1000', placeholder: 'What does it say? Copy the claim or describe it in your own words.', 'aria-label': 'The claim' });
    const url = el('input', { type: 'url', maxlength: '500', placeholder: 'https://… (optional)' });
    const seen = select(SEEN, 'Choose…');
    const topic = select(TOPICS);
    const send = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Send for fact-checking', onclick: async () => {
      if (claim.value.trim().length < 10) { msg.textContent = 'Describe the claim in a sentence or two.'; return; }
      if (url.value.trim() && !/^https?:\/\/\S+$/.test(url.value.trim())) { msg.textContent = 'The link must start with https://'; return; }
      send.disabled = true;
      const { error } = await db.rpc('forum_factcheck_request', { p_claim: claim.value, p_url: url.value.trim() || null, p_seen: seen.value || null, p_topic: topic.value || 'other' });
      send.disabled = false;
      if (error) { msg.textContent = error.message; return; }
      claim.value = ''; url.value = '';
      msg.textContent = 'Sent. You will get an alert when a fact-checker answers.';
      mine();
    } });
    const mineBox = el('div', { class: 'fm-check-list' });
    async function mine() {
      const { data } = await db.from('forum_factchecks').select('id,claim,topic,seen_on,status,verdict,summary,sources,reject_reason,answered_at,created_at').eq('requester_id', state.me.user_id).order('created_at', { ascending: false }).limit(30);
      mineBox.replaceChildren(...(data?.length ? data.map((c) => checkCard(c)) : [el('p', { class: 'fm-muted', text: 'You have not asked for a fact-check yet.' })]));
    }
    body.replaceChildren(
      el('div', { class: 'fm-org-form' }, [
        el('h3', { text: 'Ask for a fact-check' }),
        el('p', { class: 'fm-small fm-muted', text: 'Saw something on WhatsApp, social media or the news and not sure it’s true? Send it here before you share it. Do not include anyone’s phone number, address or other private details.' }),
        field('The claim', claim),
        field('Link to where you saw it', url, '(optional)'),
        el('div', { class: 'fm-two' }, [field('Where did you see it?', seen), field('Topic', topic)]),
        el('div', { class: 'fm-actions' }, [send]),
        msg
      ]),
      el('h3', { class: 'fm-admin-h', text: 'Your requests' }),
      mineBox
    );
    mine();
  }

  // ---------------------------------------------------------------- learn
  async function learn(body) {
    const { data } = await db.from('forum_mil_progress').select('module,completed_at').eq('user_id', state.me.user_id);
    const done = new Set((data || []).map((r) => r.module));
    const bar = el('div', { class: 'fm-mil-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '6', 'aria-valuenow': String(done.size), 'aria-label': 'Modules completed' }, [el('span', { style: `width:${Math.round((done.size / 6) * 100)}%` })]);
    const head = el('div', { class: 'fm-mil-learn-head' }, [
      el('div', {}, [
        el('strong', { text: done.size === 6 ? '🎓 You are an MIL Ambassador' : `${done.size} of 6 modules complete` }),
        el('p', { class: 'fm-small fm-muted', text: done.size === 6 ? 'The MIL Ambassador badge now shows on your profile. Share what you learned and help others check facts.' : 'Finish all six modules to earn the MIL Ambassador badge on your profile.' })
      ]),
      bar
    ]);
    body.replaceChildren(head, el('div', { class: 'fm-mil-modules' }, MODULES.map((m) => moduleCard(m, done.has(m.n), () => learn(body)))));
  }

  function moduleCard(m, isDone, reload) {
    const panel = el('div', { class: 'fm-mil-lesson', hidden: '' });
    const msg = status();
    const btn = el('button', { type: 'button', class: isDone ? 'hp-btn hp-btn-outline' : 'hp-btn hp-btn-primary', text: isDone ? 'Review lesson' : 'Start lesson', 'aria-expanded': 'false', onclick: () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open && !panel.firstChild) fill();
    } });
    function fill() {
      const complete = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Mark module complete', disabled: '', onclick: async () => {
        complete.disabled = true;
        const { error } = await db.from('forum_mil_progress').insert({ user_id: state.me.user_id, module: m.n });
        if (error && error.code !== '23505') { msg.textContent = 'Could not save your progress. Try again.'; complete.disabled = false; return; }
        reload();
      } });
      const feedback = el('p', { class: 'fm-small', role: 'status' });
      const answers = el('div', { class: 'fm-mil-answers', role: 'radiogroup', 'aria-label': m.quiz.q }, m.quiz.a.map((a, i) => [a, i]).sort(() => Math.random() - 0.5).map(([a, i]) => el('button', { type: 'button', class: 'fm-mil-answer', text: a, onclick: (e) => {
        answers.querySelectorAll('button').forEach((b) => b.classList.remove('is-right', 'is-wrong'));
        const right = i === m.quiz.ok;
        e.currentTarget.classList.add(right ? 'is-right' : 'is-wrong');
        feedback.textContent = right ? `Correct. ${m.quiz.why}` : 'Not quite. Read the key points again and try another answer.';
        if (right && !isDone) complete.disabled = false;
      } })));
      panel.append(...[
        el('ul', { class: 'fm-mil-points' }, m.points.map((p) => el('li', { text: p }))),
        el('div', { class: 'fm-mil-quiz' }, [el('strong', { text: 'Exercise' }), el('p', { text: m.quiz.q }), answers, feedback]),
        isDone ? el('p', { class: 'fm-small fm-muted', text: '✓ You completed this module.' }) : el('div', { class: 'fm-actions' }, [complete]),
        msg
      ]);
    }
    return el('article', { class: `fm-mil-module${isDone ? ' is-done' : ''}` }, [
      el('div', { class: 'fm-mil-module-head' }, [
        el('span', { class: 'fm-mil-num', 'aria-hidden': 'true', text: isDone ? '✓' : String(m.n) }),
        el('div', {}, [el('strong', { text: `Module ${m.n}: ${m.title}` }), el('p', { class: 'fm-small fm-muted', text: m.lead })])
      ]),
      btn, panel
    ]);
  }

  // ---------------------------------------------------------------- review (fact-checkers)
  async function review(body) {
    const me = state.me.user_id;
    const { data } = await db.from('forum_factchecks').select('*').in('status', ['open', 'in_review']).order('created_at').limit(100);
    const rows = data || [];
    const mineRows = rows.filter((c) => c.status === 'in_review' && c.checker_id === me);
    const open = rows.filter((c) => c.status === 'open');
    const others = rows.filter((c) => c.status === 'in_review' && c.checker_id !== me);
    const kids = [
      el('h3', { class: 'fm-admin-h', text: `Your reviews (${mineRows.length})` }),
      mineRows.length ? el('div', { class: 'fm-admin-list' }, mineRows.map((c) => answerCard(c, () => review(body)))) : el('p', { class: 'fm-muted', text: 'Pick a request below to start checking it.' }),
      el('h3', { class: 'fm-admin-h', text: `Waiting for a fact-checker (${open.length})` }),
      open.length ? el('div', { class: 'fm-admin-list' }, open.map((c) => openCard(c, () => review(body)))) : el('p', { class: 'fm-empty', text: 'No requests waiting. 🎉' })
    ];
    if (others.length) kids.push(el('h3', { class: 'fm-admin-h', text: `Being checked by others (${others.length})` }), el('div', { class: 'fm-admin-list' }, others.map((c) => {
      const msg = status();
      return el('article', { class: 'fm-admin-card' }, [checkCard(c, { full: true }), state.isStaff ? el('button', { type: 'button', class: 'fm-text-btn', text: 'Release back to the queue', onclick: async () => {
        const { error } = await db.rpc('forum_factcheck_release', { p_id: c.id }); if (error) msg.textContent = error.message; else review(body);
      } }) : null, msg].filter(Boolean));
    })));
    if (state.isStaff) kids.push(await checkersPanel(() => review(body)));
    body.replaceChildren(...kids);
  }

  function rejectForm(c, slot, done) {
    if (slot.firstChild) return;
    const msg = status();
    const reason = el('input', { maxlength: '300', placeholder: 'Why it can’t be checked (e.g. opinion, not a factual claim; duplicate; personal information)', 'aria-label': 'Reason' });
    slot.append(el('div', { class: 'fm-collab-invite' }, [reason, el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Close request', onclick: async () => {
      const { error } = await db.rpc('forum_factcheck_reject', { p_id: c.id, p_reason: reason.value });
      if (error) msg.textContent = error.message; else done();
    } }), msg]));
    reason.focus();
  }

  function openCard(c, done) {
    const msg = status();
    const slot = el('div');
    const own = c.requester_id === state.me.user_id;
    return el('article', { class: 'fm-admin-card' }, [checkCard(c, { full: true }),
      el('div', { class: 'fm-actions' }, [
        own ? el('small', { class: 'fm-muted', text: 'Your own request: another fact-checker will take it.' }) : el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Start checking', onclick: async () => {
          const { error } = await db.rpc('forum_factcheck_claim', { p_id: c.id }); if (error) msg.textContent = error.message; else done();
        } }),
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Can’t be checked…', onclick: () => rejectForm(c, slot, done) })
      ]), slot, msg]);
  }

  function answerCard(c, done) {
    const msg = status();
    const slot = el('div');
    const verdict = select(Object.fromEntries(Object.entries(VERDICTS).map(([k, v]) => [k, `${v[0]}: ${v[1]}`])), 'Choose a verdict…');
    const summary = el('textarea', { rows: '6', maxlength: '3000', placeholder: 'Explain what you found in plain language: what is true, what is not, and how you checked.', 'aria-label': 'Explanation' });
    const sources = el('div', { class: 'fm-check-src-rows' });
    const addRow = () => {
      if (sources.children.length >= 8) return;
      const row = el('div', { class: 'fm-two' }, [
        el('input', { maxlength: '120', placeholder: 'Source title (e.g. WHO malaria fact sheet)', 'aria-label': 'Source title' }),
        el('input', { type: 'url', maxlength: '500', placeholder: 'https://…', 'aria-label': 'Source link' })
      ]);
      sources.append(row);
    };
    addRow(); addRow();
    const publish = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Publish fact-check', onclick: async () => {
      const src = [...sources.children].map((r) => { const [t, u] = r.querySelectorAll('input'); return { title: t.value.trim(), url: u.value.trim() }; }).filter((s) => s.title || s.url);
      if (!verdict.value) { msg.textContent = 'Choose a verdict.'; return; }
      if (summary.value.trim().length < 30) { msg.textContent = 'Explain the verdict in at least two sentences.'; return; }
      if (!src.length || src.some((s) => s.title.length < 2 || !/^https:\/\/\S+$/.test(s.url))) { msg.textContent = 'Add at least one source, each with a title and a link starting with https://'; return; }
      publish.disabled = true;
      const { error } = await db.rpc('forum_factcheck_answer', { p_id: c.id, p_verdict: verdict.value, p_summary: summary.value, p_sources: src });
      publish.disabled = false;
      if (error) msg.textContent = error.message; else done();
    } });
    return el('article', { class: 'fm-admin-card' }, [checkCard(c, { full: true }),
      el('div', { class: 'fm-org-form fm-check-answer' }, [
        field('Verdict', verdict),
        field('Explanation', summary),
        el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'Sources (1 to 8, https links)' }), sources,
          el('button', { type: 'button', class: 'fm-text-btn', text: '+ Add source', onclick: addRow })]),
        el('div', { class: 'fm-actions' }, [publish,
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Release', onclick: async () => { const { error } = await db.rpc('forum_factcheck_release', { p_id: c.id }); if (error) msg.textContent = error.message; else done(); } }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Can’t be checked…', onclick: () => rejectForm(c, slot, done) })])
      ]), slot, msg]);
  }

  // Staff: appoint and remove fact-checkers.
  async function checkersPanel(done) {
    const msg = status();
    const { data: rows } = await db.from('forum_factcheckers').select('user_id,added_at').order('added_at');
    const ids = (rows || []).map((r) => r.user_id);
    const { data: profs } = ids.length ? await db.from('forum_profiles').select('user_id,display_name,headline,avatar_url').in('user_id', ids) : { data: [] };
    const pm = new Map((profs || []).map((p) => [p.user_id, p]));
    const search = el('input', { type: 'search', maxlength: '60', placeholder: 'Find a member by name to appoint', 'aria-label': 'Find a member' });
    const results = el('div', { class: 'fm-admin-list' });
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
      const term = search.value.replace(/[%_,()\\]/g, ' ').trim();
      if (term.length < 2) { results.replaceChildren(); return; }
      const { data } = await db.from('forum_profiles').select('user_id,display_name,headline,avatar_url').eq('verification_status', 'approved').ilike('display_name', `%${term}%`).limit(8);
      results.replaceChildren(...(data || []).filter((p) => !pm.has(p.user_id)).map((p) => who(p, el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Appoint', onclick: async () => {
        const { error } = await db.from('forum_factcheckers').insert({ user_id: p.user_id, added_by: state.me.user_id });
        if (error) msg.textContent = 'Could not appoint this member.'; else done();
      } }))));
    }, 350); });
    function who(p, action) {
      const av = el('div', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' }); fillAvatar(av, p);
      return el('div', { class: 'fm-admin-card fm-check-person' }, [el('a', { class: 'fm-net-who', href: `#profile/${p.user_id}` }, [av, el('span', {}, [el('strong', { text: p.display_name }), el('small', { text: p.headline || 'Member' })])]), action]);
    }
    return el('section', { class: 'fm-pro-block fm-check-team' }, [
      el('h3', { class: 'fm-admin-h', text: `Fact-checkers (${ids.length})` }),
      el('p', { class: 'fm-small fm-muted', text: 'WHSF moderators are fact-checkers automatically. Appoint trained, ID-verified members to help answer requests.' }),
      ...ids.map((id) => who(pm.get(id) || { user_id: id, display_name: 'Member' }, el('button', { type: 'button', class: 'fm-text-btn', text: 'Remove', onclick: async () => {
        const { error } = await db.from('forum_factcheckers').delete().eq('user_id', id);
        if (error) msg.textContent = 'Could not remove.'; else done();
      } }))),
      search, results, msg
    ]);
  }

  F.hooks.view.push((view) => { if (view === 'mil') render(); });
  F.hooks.refresh.push(() => { checker = null; });
})();
