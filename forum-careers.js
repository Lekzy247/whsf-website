// WHSF Forum add-on: Career Center and NGO Partnerships.
// #careers/<jobs|applications|employer>, #job/<id>, #orgs (directory) and #org/<id>.
// Employers are verified by WHSF (registration certificate, official website, Tax ID / EIN) before they can post.
// Applicants apply with a CV (PDF or Word) that only the employer they apply to can open.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  const TYPES = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', internship: 'Internship', volunteer: 'Volunteer', fellowship: 'Fellowship' };
  const PLACES = { onsite: 'On-site', remote: 'Remote', hybrid: 'Hybrid' };
  const KINDS = { employer: 'Employer', ngo: 'NGO / nonprofit', both: 'NGO that also hires' };
  const STATUS = { submitted: 'Submitted', reviewing: 'Under review', shortlisted: 'Shortlisted', interview: 'Interview', offered: 'Offer', not_selected: 'Not selected', withdrawn: 'Withdrawn' };
  const ORG_STATUS = { pending: 'Waiting for WHSF verification', verified: 'Verified by WHSF', rejected: 'Not verified', suspended: 'Suspended' };
  const JOB_COLS = 'id,org_id,title,employment_type,workplace,location,country,salary_min,salary_max,salary_currency,salary_period,description,skills,deadline,status,created_at,org:forum_orgs(id,name,kind,website,country,status,logo_url)';
  const MB = 1024 * 1024;
  const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const ago = (iso) => { const d = Math.floor((Date.now() - new Date(iso)) / 86400000); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; };
  const money = (n, c) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c || 'USD', maximumFractionDigits: 0 }).format(n); } catch { return `${c || 'USD'} ${Number(n).toLocaleString()}`; } };
  const salary = (j) => (j.salary_min || j.salary_max
    ? `${j.salary_min ? money(j.salary_min, j.salary_currency) : ''}${j.salary_min && j.salary_max ? ' – ' : ''}${j.salary_max ? money(j.salary_max, j.salary_currency) : ''} / ${j.salary_period || 'year'}`
    : null);
  const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const logo = (org) => el('span', { class: 'fm-org-logo', 'aria-hidden': 'true', text: initials(org?.name) });
  const verified = (org) => (org?.status === 'verified' ? el('span', { class: 'fm-verified', title: 'Verified by WHSF', text: ' ✔' }) : null);
  const status = () => el('p', { class: 'fm-status', role: 'status' });
  const mySkills = () => (state.me?.skills || []).map((s) => s.toLowerCase());
  const matchOf = (skills, mine) => {
    const need = (skills || []).map((s) => s.toLowerCase());
    if (!need.length) return null;
    return Math.round((need.filter((s) => mine.includes(s)).length / need.length) * 100);
  };
  let myOrg; // cached for the session

  async function loadMyOrg() {
    const { data } = await db.from('forum_orgs').select('id,name,kind,website,country,sector,about,status,review_note,created_at').eq('owner_id', state.me.user_id).maybeSingle();
    myOrg = data || null;
    return myOrg;
  }
  async function loadMeSkills() {
    if (state.me && !state.me.skills) {
      const { data } = await db.from('forum_profiles').select('skills').eq('user_id', state.me.user_id).maybeSingle();
      state.me.skills = data?.skills || [];
    }
  }

  // ---------------------------------------------------------------- Career Center
  const TABS = [['jobs', 'Find jobs'], ['africa', 'Jobs in Africa'], ['remote', 'Remote abroad'], ['applications', 'My applications'], ['employer', 'For employers']];
  async function renderCareers() {
    const box = $('[data-fm-careers]');
    if (!box || !state.me) return;
    const tab = TABS.some(([k]) => k === (location.hash.split('/')[1] || '')) ? location.hash.split('/')[1] : 'jobs';
    const body = el('div', { class: 'fm-careers-body' }, [el('p', { class: 'fm-muted', text: 'Loading…' })]);
    box.replaceChildren(
      el('div', { class: 'fm-fund-head' }, [
        el('div', {}, [el('h2', { text: 'Career Center' }), el('p', { class: 'fm-muted', text: 'Jobs from organisations verified by WHSF, plus jobs across Africa and remote jobs abroad from trusted job boards, updated every day. Applying is always free: never pay anyone for a job.' })]),
        el('a', { class: 'fm-text-btn', href: '#orgs', text: 'Verified organisations →' })
      ]),
      el('nav', { class: 'fm-admin-tabs', 'aria-label': 'Career Center' }, TABS.map(([k, t]) => { const a = el('a', { href: `#careers/${k}`, class: `fm-admin-tab${k === tab ? ' is-on' : ''}`, text: t }); if (k === tab) a.setAttribute('aria-current', 'page'); return a; })),
      body
    );
    await loadMeSkills();
    if (tab === 'applications') return applications(body);
    if (tab === 'employer') return employer(body);
    if (tab === 'africa' || tab === 'remote') return partnerJobs(body, tab, decodeURIComponent(location.hash.split('/')[2] || ''));
    return jobs(body);
  }

  function jobCard(j, match) {
    const sal = salary(j);
    return el('a', { class: 'fm-job-card', href: `#job/${j.id}` }, [
      logo(j.org),
      el('span', { class: 'fm-job-main' }, [
        el('strong', { text: j.title }),
        el('span', { class: 'fm-job-org' }, [j.org?.name || 'Organisation', verified(j.org)]),
        el('small', { class: 'fm-muted', text: [TYPES[j.employment_type], PLACES[j.workplace], j.location || j.country].filter(Boolean).join(' · ') }),
        sal ? el('small', { class: 'fm-job-pay', text: sal }) : null,
        el('small', { class: 'fm-muted', text: `Posted ${ago(j.created_at)}${j.deadline ? ` · Apply by ${day(j.deadline)}` : ''}` })
      ]),
      match ? el('span', { class: 'fm-match', title: 'How many of the skills asked for are on your profile', text: `${match}% match` }) : null
    ]);
  }

  async function jobs(body) {
    const f = { q: '', type: '', place: '', country: '' };
    const list = el('div', { class: 'fm-job-list' });
    const rec = el('div', { class: 'fm-job-rec' });
    const run = async () => {
      list.replaceChildren(el('p', { class: 'fm-muted', text: 'Searching…' }));
      const today = new Date().toISOString().slice(0, 10);
      let q = db.from('forum_jobs').select(JOB_COLS).eq('status', 'open').or(`deadline.is.null,deadline.gte.${today}`).order('created_at', { ascending: false }).limit(50);
      if (f.q) { const like = `%${f.q.replace(/[%_,()\\]/g, ' ')}%`; q = q.ilike('title', like); }
      if (f.type) q = q.eq('employment_type', f.type);
      if (f.place) q = q.eq('workplace', f.place);
      if (f.country) q = q.ilike('country', `%${f.country.replace(/[%_,()\\]/g, ' ')}%`);
      const { data, error } = await q;
      const rows = (data || []).filter((j) => j.org?.status === 'verified');
      const mine = mySkills();
      list.replaceChildren(...(error ? [el('p', { class: 'fm-muted', text: 'Jobs could not be loaded.' })]
        : rows.length ? rows.map((j) => jobCard(j, matchOf(j.skills, mine))) : [el('p', { class: 'fm-empty' }, [
          'No open jobs from WHSF-verified organisations match these filters yet. ',
          el('a', { href: '#careers/africa', text: 'Browse jobs in Africa' }), ' or ', el('a', { href: '#careers/remote', text: 'remote jobs abroad' }), ' (updated daily).'
        ])]));
    };
    const sel = (key, label, opts) => { const s = el('select', { 'aria-label': label }, [el('option', { value: '', text: label }), ...Object.entries(opts).map(([v, t]) => el('option', { value: v, text: t }))]); s.addEventListener('change', () => { f[key] = s.value; run(); }); return s; };
    const search = el('input', { type: 'search', placeholder: 'Search job titles', 'aria-label': 'Search jobs', maxlength: '80' });
    const country = el('input', { type: 'search', placeholder: 'Country', 'aria-label': 'Country', maxlength: '60' });
    let t; const deb = (k, n) => n.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f[k] = n.value.trim(); run(); }, 350); });
    deb('q', search); deb('country', country);
    body.replaceChildren(
      rec,
      el('div', { class: 'fm-fund-filters' }, [search, sel('type', 'Any job type', TYPES), sel('place', 'On-site or remote', PLACES), country]),
      list
    );
    run();
    // Recommended for you (skills overlap)
    const { data: m } = await db.rpc('forum_job_matches', { p_limit: 3 });
    const top = (m || []).filter((r) => r.score > 0);
    if (top.length) {
      const { data: js } = await db.from('forum_jobs').select(JOB_COLS).in('id', top.map((r) => r.job_id));
      const mine = mySkills();
      rec.replaceChildren(el('h3', { class: 'fm-admin-h', text: '✨ Recommended for you' }), el('div', { class: 'fm-job-list' }, (js || []).map((j) => jobCard(j, matchOf(j.skills, mine)))));
    } else if (!mySkills().length) {
      rec.replaceChildren(el('p', { class: 'fm-small fm-callout' }, ['Add your skills under ', el('a', { href: '#me', text: 'Me → Professional profile' }), ' to see jobs that match you.']));
    }
  }

  // ---------------------------------------------------------------- jobs from partner job boards
  // Filled once a day by api/jobs-sync.js (Himalayas + Jobicy). Their terms: credit the source and apply through
  // their own link, so every card opens the source's job page in a new tab and says where it comes from.
  const AFRICA = ['Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Egypt', 'Ethiopia', 'Rwanda', 'Uganda', 'Tanzania', 'Morocco',
    'Tunisia', 'Algeria', 'Senegal', "Côte d'Ivoire", 'Cameroon', 'Zambia', 'Zimbabwe', 'Malawi', 'Mozambique', 'Botswana',
    'Namibia', 'DR Congo', 'Sierra Leone', 'Liberia', 'Gambia', 'Benin', 'Togo', 'Burkina Faso', 'Mali', 'Niger', 'Sudan',
    'South Sudan', 'Somalia', 'Madagascar', 'Mauritius', 'Angola'];
  const SOURCES = { himalayas: ['Himalayas', 'https://himalayas.app'], jobicy: ['Jobicy', 'https://jobicy.com'] };
  const PJ_COLS = 'id,source,title,company,company_logo,url,location_restrictions,restriction_count,worldwide,employment_type,seniority,category,salary_min,salary_max,currency,salary_period,published_at,first_seen_at';
  const PJ_PAGE = 30;
  const PJ_TYPES = { full: 'Full-time', part: 'Part-time', contract: 'Contract', intern: 'Internship', volunteer: 'Volunteer' };
  const isNew = (j) => j.first_seen_at && Date.now() - new Date(j.first_seen_at) < 86400000;
  let pjCounts = null;
  async function partnerCounts() {
    if (pjCounts) return pjCounts;
    const { data } = await db.rpc('forum_partner_job_counts');
    pjCounts = Object.fromEntries((data || []).map((r) => [r.country, r]));
    return pjCounts;
  }
  function openTo(j) {
    if (j.restriction_count && j.restriction_count <= 4) return `Open to people in ${j.location_restrictions.join(', ')}`;
    if (j.restriction_count) return `Open to people in ${j.restriction_count} countries`;
    return 'Open to people anywhere';
  }
  function partnerCard(j) {
    const [srcName] = SOURCES[j.source] || ['the job board'];
    const per = { annual: 'year', yearly: 'year', monthly: 'month', weekly: 'week', daily: 'day', hourly: 'hour' }[String(j.salary_period || '').toLowerCase()] || j.salary_period;
    const sal = j.salary_min || j.salary_max ? salary({ salary_min: j.salary_min, salary_max: j.salary_max === j.salary_min ? null : j.salary_max, salary_currency: j.currency, salary_period: per }) : null;
    const pic = j.company_logo
      ? el('img', { class: 'fm-org-logo fm-org-logo-img', src: j.company_logo, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: (e) => e.target.replaceWith(logo({ name: j.company })) })
      : logo({ name: j.company });
    return el('a', { class: 'fm-job-card', href: j.url, target: '_blank', rel: 'noopener', 'aria-label': `${j.title} at ${j.company || 'a company'} (opens ${srcName} in a new tab)` }, [
      pic,
      el('span', { class: 'fm-job-main' }, [
        el('strong', { text: j.title }),
        el('span', { class: 'fm-job-org', text: j.company || 'Company' }),
        el('small', { class: 'fm-muted', text: [j.employment_type, j.seniority, j.category].filter(Boolean).join(' · ') }),
        el('small', { class: 'fm-muted', text: openTo(j) }),
        sal ? el('small', { class: 'fm-job-pay', text: sal }) : null,
        el('small', { class: 'fm-muted', text: `${j.published_at ? `Posted ${ago(j.published_at)} · ` : ''}via ${srcName} ↗` })
      ]),
      isNew(j) ? el('span', { class: 'fm-match', text: 'New' }) : null
    ]);
  }

  async function partnerJobs(body, kind, pick) {
    const counts = await partnerCounts();
    const africa = kind === 'africa';
    const myPlace = AFRICA.find((c) => (state.me?.location || '').toLowerCase().includes(c.toLowerCase()));
    const f = { q: '', type: '', country: africa ? (AFRICA.includes(pick) ? pick : myPlace || '') : '' };
    let from = 0;
    const list = el('div', { class: 'fm-job-list' });
    const more = el('button', { type: 'button', class: 'fm-chip-btn', text: 'Show more jobs', hidden: '' });
    const summary = el('p', { class: 'fm-small fm-muted' });

    const query = () => {
      let q = db.from('forum_partner_jobs').select(PJ_COLS, { count: 'exact' }); // expired jobs are hidden by the database policy
      if (africa) q = f.country ? q.contains('match_countries', [f.country]) : q.not('match_countries', 'eq', '{}');
      else q = q.eq('worldwide', true);
      if (f.q) { const like = `%${f.q.replace(/[%_,()\\.*:"']/g, ' ').trim()}%`; q = q.or(`title.ilike.${like},company.ilike.${like}`); }
      if (f.type) q = q.ilike('employment_type', `%${f.type}%`);
      if (africa && f.country) q = q.order('restriction_count', { ascending: true }).order('published_at', { ascending: false });
      else q = q.order('published_at', { ascending: false });
      return q.range(from, from + PJ_PAGE - 1);
    };
    const run = async (append = false) => {
      if (!append) { from = 0; list.replaceChildren(el('p', { class: 'fm-muted', text: 'Searching…' })); }
      more.disabled = true;
      const { data, count, error } = await query();
      more.disabled = false;
      if (error) { list.replaceChildren(el('p', { class: 'fm-muted', text: 'Jobs could not be loaded. Please try again.' })); more.hidden = true; return; }
      const cards = (data || []).map(partnerCard);
      if (append) list.append(...cards);
      else list.replaceChildren(...(cards.length ? cards : [el('p', { class: 'fm-empty', text: 'No jobs match these filters right now. New jobs arrive every morning.' })]));
      from += (data || []).length;
      more.hidden = from >= (count || 0);
      const where = africa ? (f.country ? `open to people in ${f.country}` : 'across Africa') : 'open to people anywhere';
      summary.textContent = count ? `${count.toLocaleString()} job${count === 1 ? '' : 's'} ${where}${africa && f.country ? ' (jobs only for this country first)' : ''}.` : '';
    };
    more.addEventListener('click', () => run(true));

    const chips = africa ? el('div', { class: 'fm-chips fm-country-chips', role: 'group', 'aria-label': 'Choose a country' },
      [['', 'All Africa'], ...AFRICA.map((c) => [c, c])].map(([value, label]) => {
        const n = value ? counts[value]?.jobs : null;
        const b = el('button', { type: 'button', class: `fm-chip-btn${value === f.country ? ' is-on' : ''}`, 'aria-pressed': String(value === f.country), text: n ? `${label} · ${n}` : label });
        if (value && !n && Object.keys(counts).length && value !== f.country) b.hidden = true; // no open jobs for this country yet
        b.addEventListener('click', () => {
          f.country = value;
          chips.querySelectorAll('.fm-chip-btn').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
          history.replaceState(null, '', `#careers/africa${value ? `/${encodeURIComponent(value)}` : ''}`);
          run();
        });
        return b;
      })) : null;

    const search = el('input', { type: 'search', placeholder: africa ? 'Search job titles or companies' : 'Search remote jobs (e.g. developer, finance, health)', 'aria-label': 'Search jobs', maxlength: '80' });
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { f.q = search.value.trim(); run(); }, 350); });
    const type = el('select', { 'aria-label': 'Job type' }, [el('option', { value: '', text: 'Any job type' }), ...Object.entries(PJ_TYPES).map(([v, x]) => el('option', { value: v, text: x }))]);
    type.addEventListener('change', () => { f.type = type.value; run(); });

    const fresh = africa ? null : counts.__worldwide__?.new_today;
    body.replaceChildren(...[
      el('div', { class: 'fm-small fm-callout' }, [
        el('strong', { text: africa ? 'Jobs open to people living in African countries. ' : 'Remote jobs abroad you can do from anywhere. ' }),
        'Updated every morning from trusted job boards (', el('a', { href: SOURCES.himalayas[1], target: '_blank', rel: 'noopener', text: 'Himalayas' }), ' and ',
        el('a', { href: SOURCES.jobicy[1], target: '_blank', rel: 'noopener', text: 'Jobicy' }), '). You apply on their site. WHSF has not checked these employers: ',
        'never pay to apply, and never send bank details or ID before a real interview.'
      ]),
      chips,
      el('div', { class: 'fm-fund-filters' }, [search, type]),
      fresh ? el('p', { class: 'fm-small', text: `✨ ${fresh} new today` }) : null,
      summary,
      list,
      more
    ].filter(Boolean));
    run();
  }

  // ---------------------------------------------------------------- job page
  async function renderJob(id) {
    const box = $('[data-fm-job]');
    if (!box || !state.me) return;
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading job…' }));
    await loadMeSkills();
    const [{ data: j }, { data: app }] = await Promise.all([
      db.from('forum_jobs').select(JOB_COLS).eq('id', id).maybeSingle(),
      db.from('forum_job_applications').select('id,status,cv_name,created_at').eq('job_id', id).eq('applicant_id', state.me.user_id).maybeSingle()
    ]);
    if (!j || j.org?.status !== 'verified') { box.replaceChildren(el('a', { class: 'fm-text-btn', href: '#careers', text: '← Career Center' }), el('p', { text: 'This job is not available.' })); return; }
    const closed = j.status !== 'open' || (j.deadline && j.deadline < new Date().toISOString().slice(0, 10));
    const isOwner = myOrg?.id === j.org_id || (await loadMyOrg())?.id === j.org_id;
    const match = matchOf(j.skills, mySkills());
    const sal = salary(j);
    const panel = el('aside', { class: 'fm-job-apply' });
    if (isOwner) panel.append(el('p', { text: 'This is your organisation\'s job.' }), el('a', { class: 'hp-btn hp-btn-primary', href: '#careers/employer', text: 'See applicants' }));
    else if (app && app.status !== 'withdrawn') {
      panel.append(el('strong', { text: 'You applied' }), el('p', { class: 'fm-small', text: `${STATUS[app.status]} · ${day(app.created_at)} · ${app.cv_name}` }), el('a', { class: 'hp-btn hp-btn-outline', href: '#careers/applications', text: 'My applications' }));
    } else if (closed) panel.append(el('p', { text: 'Applications for this job have closed.' }));
    else panel.append(applyForm(j));
    box.replaceChildren(
      el('a', { class: 'fm-text-btn', href: '#careers', text: '← Career Center' }),
      el('div', { class: 'fm-job-layout' }, [
        el('article', { class: 'fm-job-detail' }, [
          el('div', { class: 'fm-job-top' }, [logo(j.org), el('div', {}, [
            el('h2', { text: j.title }),
            el('a', { class: 'fm-job-org', href: `#org/${j.org_id}` }, [j.org.name, verified(j.org)]),
            el('p', { class: 'fm-muted', text: [TYPES[j.employment_type], PLACES[j.workplace], j.location || j.country].filter(Boolean).join(' · ') })
          ])]),
          el('div', { class: 'fm-job-facts' }, [
            sal ? el('span', {}, [el('small', { text: 'Pay' }), el('b', { text: sal })]) : null,
            el('span', {}, [el('small', { text: 'Posted' }), el('b', { text: day(j.created_at) })]),
            j.deadline ? el('span', {}, [el('small', { text: 'Apply by' }), el('b', { text: day(j.deadline) })]) : null,
            match !== null ? el('span', {}, [el('small', { text: 'Your match' }), el('b', { text: `${match}%` })]) : null
          ]),
          j.skills?.length ? el('div', {}, [el('h3', { text: 'Skills' }), el('div', { class: 'fm-opp-tags fm-skill-tags' }, j.skills.map((s) => el('span', { class: mySkills().includes(s.toLowerCase()) ? 'is-have' : '', text: s })))]) : null,
          el('h3', { text: 'About the role' }),
          el('p', { class: 'fm-job-desc', text: j.description }),
          el('p', { class: 'fm-small fm-muted', text: 'WHSF verified this organisation\'s registration certificate, official website and tax ID. Never pay a fee to apply or to be hired. Report any request for money to info@worldhsfoundation.org.' })
        ]),
        panel
      ])
    );
  }

  async function checkCv(file) {
    if (file.size > 5 * MB) return 'Your CV must be 5 MB or smaller.';
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const isPdf = String.fromCharCode(...head) === '%PDF-' && /\.pdf$/i.test(file.name);
    const isDocx = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04 && /\.docx$/i.test(file.name);
    return isPdf || isDocx ? null : 'Upload your CV as a PDF or Word (.docx) file.';
  }

  function applyForm(j) {
    let file = null;
    const msg = status();
    const input = el('input', { type: 'file', accept: '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document', hidden: '' });
    const chosen = el('small', { class: 'fm-muted', text: 'PDF or Word (.docx), up to 5 MB' });
    input.addEventListener('change', async () => {
      const f = input.files[0]; input.value = '';
      if (!f) return;
      const problem = await checkCv(f);
      if (problem) { file = null; chosen.textContent = problem; return; }
      file = f; chosen.textContent = `✓ ${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`;
    });
    const note = el('textarea', { rows: '5', maxlength: '2000', placeholder: 'Why you are a great fit (optional)', 'aria-label': 'Cover note' });
    const consent = el('input', { type: 'checkbox' });
    const send = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Submit application', onclick: async () => {
      if (!file) { msg.textContent = 'Upload your CV first.'; return; }
      if (!consent.checked) { msg.textContent = 'Please tick the box to share your CV with this employer.'; return; }
      send.disabled = true; msg.textContent = 'Uploading your CV…';
      const ext = /\.docx$/i.test(file.name) ? 'docx' : 'pdf';
      const path = `${j.id}/${state.me.user_id}/${crypto.randomUUID()}.${ext}`;
      const type = ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const { error: upErr } = await db.storage.from('forum-cvs').upload(path, file, { contentType: type, upsert: false });
      if (upErr) { send.disabled = false; msg.textContent = 'Your CV could not be uploaded. Please try again.'; return; }
      const { error } = await db.rpc('forum_job_apply', { p_job: j.id, p_cv_path: path, p_cv_name: file.name.replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || `CV.${ext}`, p_note: note.value });
      if (error) { db.storage.from('forum-cvs').remove([path]).catch(() => {}); send.disabled = false; msg.textContent = error.message; return; }
      renderJob(j.id);
    } });
    return el('div', { class: 'fm-apply' }, [
      el('strong', { text: 'Apply for this job' }),
      el('label', { class: 'hp-btn hp-btn-outline fm-file-pick' }, ['⬆ Upload your CV', input]), chosen,
      el('label', { class: 'fm-field' }, ['Cover note', note]),
      el('label', { class: 'fm-check' }, [consent, el('span', { text: `Share my CV, cover note and Forum profile with ${j.org.name} for this job only.` })]),
      send, msg
    ]);
  }

  // ---------------------------------------------------------------- my applications
  async function applications(body) {
    const { data } = await db.from('forum_job_applications').select('id,job_id,status,cv_name,cv_path,created_at,updated_at,job:forum_jobs(title,org:forum_orgs(name))').eq('applicant_id', state.me.user_id).order('created_at', { ascending: false });
    body.replaceChildren(...(data?.length ? data.map((a) => {
      const msg = status();
      return el('article', { class: 'fm-admin-card' }, [
        el('div', { class: 'fm-admin-card-head' }, [el('a', { href: `#job/${a.job_id}` }, [el('strong', { text: a.job?.title || 'Job' })]), el('span', { class: `fm-app-status is-${a.status}`, text: STATUS[a.status] })]),
        el('p', { class: 'fm-small', text: `${a.job?.org?.name || ''} · applied ${day(a.created_at)} · CV: ${a.cv_name}` }),
        el('div', { class: 'fm-actions' }, [
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Open my CV', onclick: async () => { const { data: u } = await db.storage.from('forum-cvs').createSignedUrl(a.cv_path, 300); if (u?.signedUrl) window.open(u.signedUrl, '_blank', 'noopener'); } }),
          !['withdrawn', 'offered', 'not_selected'].includes(a.status) ? el('button', { type: 'button', class: 'fm-text-btn', text: 'Withdraw', onclick: async () => {
            const { error } = await db.rpc('forum_application_update', { p_id: a.id, p_status: 'withdrawn' });
            if (error) msg.textContent = error.message; else applications(body);
          } }) : null
        ]),
        msg
      ]);
    }) : [el('p', { class: 'fm-empty' }, ['You have not applied for any jobs yet. ', el('a', { href: '#careers/jobs', text: 'Find jobs →' })])]));
  }

  // ---------------------------------------------------------------- employers: register, post jobs, applicants
  async function employer(body) {
    const org = await loadMyOrg();
    if (!org) return body.replaceChildren(orgForm(null, body));
    const head = el('section', { class: `fm-org-status is-${org.status}` }, [
      el('div', { class: 'fm-job-top' }, [logo(org), el('div', {}, [
        el('h3', {}, [org.name, verified(org)]),
        el('p', { class: 'fm-small', text: `${KINDS[org.kind]} · ${org.country}` }),
        el('strong', { class: 'fm-org-badge', text: ORG_STATUS[org.status] }),
        org.status === 'rejected' && org.review_note ? el('p', { class: 'fm-small', text: `WHSF note: ${org.review_note}` }) : null,
        org.status === 'pending' ? el('p', { class: 'fm-small fm-muted', text: 'WHSF is checking your registration certificate, official website and tax ID. You will get an alert when it is done, usually within 3 working days.' }) : null
      ])]),
      el('div', { class: 'fm-actions' }, [
        el('a', { class: 'fm-text-btn', href: `#org/${org.id}`, text: 'View organisation page' }),
        el('button', { type: 'button', class: 'fm-text-btn', text: org.status === 'rejected' ? 'Update details and resubmit' : 'Edit details', onclick: () => body.replaceChildren(orgForm(org, body)) })
      ])
    ]);
    if (org.status !== 'verified') return body.replaceChildren(head);
    const { data: jobs } = await db.from('forum_jobs').select('id,title,employment_type,workplace,status,deadline,created_at,skills').eq('org_id', org.id).order('created_at', { ascending: false });
    const ids = (jobs || []).map((j) => j.id);
    const { data: apps } = ids.length ? await db.from('forum_job_applications').select('job_id,status').in('job_id', ids) : { data: [] };
    const countFor = (id) => (apps || []).filter((a) => a.job_id === id && a.status !== 'withdrawn').length;
    const formSlot = el('div');
    body.replaceChildren(head,
      el('div', { class: 'fm-admin-bar' }, [el('h3', { class: 'fm-admin-h', text: 'Your jobs' }), el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: '+ Post a job', onclick: () => { formSlot.replaceChildren(jobForm(org, body)); formSlot.scrollIntoView({ block: 'start', behavior: 'smooth' }); } })]),
      formSlot,
      jobs?.length ? el('div', { class: 'fm-admin-list' }, jobs.map((j) => {
        const slot = el('div');
        return el('article', { class: 'fm-admin-card' }, [
          el('div', { class: 'fm-admin-card-head' }, [el('a', { href: `#job/${j.id}` }, [el('strong', { text: j.title })]), el('span', { class: `fm-app-status is-${j.status === 'open' ? 'shortlisted' : 'withdrawn'}`, text: j.status === 'open' ? 'Open' : 'Closed' })]),
          el('p', { class: 'fm-small', text: `${TYPES[j.employment_type]} · ${PLACES[j.workplace]} · posted ${day(j.created_at)}${j.deadline ? ` · closes ${day(j.deadline)}` : ''}` }),
          el('div', { class: 'fm-actions' }, [
            el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: `Applicants (${countFor(j.id)})`, onclick: () => applicants(j, slot) }),
            el('button', { type: 'button', class: 'fm-text-btn', text: j.status === 'open' ? 'Close job' : 'Reopen job', onclick: async () => { await db.from('forum_jobs').update({ status: j.status === 'open' ? 'closed' : 'open' }).eq('id', j.id); employer(body); } })
          ]),
          slot
        ]);
      })) : el('p', { class: 'fm-empty', text: 'No jobs yet. Post your first one.' })
    );
  }

  function orgForm(org, body) {
    const msg = status();
    const f = el('form', { class: 'fm-form fm-org-form', novalidate: '' });
    const field = (label, input, hint) => el('label', {}, [label, hint ? el('small', { text: ` ${hint}` }) : null, input]);
    const inp = (name, attrs = {}) => { const i = el('input', { name, ...attrs }); if (org && org[name]) i.value = org[name]; return i; };
    const kind = el('select', { name: 'kind' }, Object.entries(KINDS).map(([v, t]) => el('option', { value: v, text: t }))); if (org) kind.value = org.kind;
    const about = el('textarea', { name: 'about', rows: '4', maxlength: '2000' }); about.value = org?.about || '';
    let cert = null;
    const certIn = el('input', { type: 'file', accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png', hidden: '' });
    const certLabel = el('small', { class: 'fm-muted', text: org ? 'Upload a new certificate only if it changed.' : 'PDF, JPG or PNG, up to 10 MB.' });
    certIn.addEventListener('change', async () => {
      const file = certIn.files[0]; certIn.value = '';
      if (!file) return;
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const ok = (String.fromCharCode(...head) === '%PDF') || (head[0] === 0xff && head[1] === 0xd8) || (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47);
      if (!ok || file.size > 10 * MB) { cert = null; certLabel.textContent = 'Use a PDF, JPG or PNG of 10 MB or less.'; return; }
      cert = file; certLabel.textContent = `✓ ${file.name}`;
    });
    const declare = el('input', { type: 'checkbox', name: 'declare' });
    f.append(
      el('h3', { text: org ? 'Update your organisation' : 'Register your organisation' }),
      el('p', { class: 'fm-small fm-muted', text: 'WHSF verifies every organisation before it can post jobs or partnership calls. Your registration number, tax ID and certificate are seen only by WHSF moderators.' }),
      el('div', { class: 'fm-two' }, [field('Organisation name', inp('name', { maxlength: '140', required: '' })), field('Type', kind)]),
      el('div', { class: 'fm-two' }, [field('Official website', inp('website', { type: 'url', maxlength: '300', placeholder: 'https://…' })), field('Country of registration', inp('country', { maxlength: '80' }))]),
      el('div', { class: 'fm-two' }, [field('Sector', inp('sector', { maxlength: '80', placeholder: 'e.g. Education, Health, Technology' }), '(optional)'), field('Work email for WHSF', el('input', { name: 'contact_email', type: 'email', maxlength: '254', placeholder: 'name@yourorganisation.org' }), '(on your website domain if possible)')]),
      field('About the organisation', about, '(optional)'),
      el('fieldset', { class: 'fm-ev-fs' }, [
        el('legend', { text: 'Verification (private)' }),
        el('div', { class: 'fm-two' }, [field('Registration number', el('input', { name: 'registration_number', maxlength: '80' })), field('Tax ID / EIN', el('input', { name: 'tax_id', maxlength: '40' }))]),
        el('div', { class: 'fm-org-cert' }, [el('label', { class: 'hp-btn hp-btn-outline fm-file-pick' }, ['⬆ Registration certificate', certIn]), certLabel])
      ]),
      el('label', { class: 'fm-check' }, [declare, el('span', { text: 'I confirm I am authorised to represent this organisation and that these details are true.' })]),
      el('div', { class: 'fm-actions' }, [el('button', { type: 'submit', class: 'hp-btn hp-btn-primary', text: org ? 'Save and send for review' : 'Submit for verification' }), org ? el('button', { type: 'button', class: 'fm-text-btn', text: 'Cancel', onclick: () => employer(body) }) : null]),
      msg
    );
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = (k) => (f.elements[k]?.value || '').trim();
      if (v('name').length < 2) return void (msg.textContent = 'Enter the organisation name.');
      if (!/^https:\/\/\S+\.\S+$/.test(v('website'))) return void (msg.textContent = 'Enter the official website, starting with https://');
      if (v('country').length < 2) return void (msg.textContent = 'Enter the country of registration.');
      if (!org && (v('registration_number').length < 3 || v('tax_id').length < 3)) return void (msg.textContent = 'Enter the registration number and Tax ID / EIN.');
      if (!org && !cert) return void (msg.textContent = 'Upload the registration certificate.');
      if (!declare.checked) return void (msg.textContent = 'Please confirm you are authorised to represent this organisation.');
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Saving…';
      const row = { name: v('name'), kind: kind.value, website: v('website'), country: v('country'), sector: v('sector') || null, about: about.value.trim() || null };
      let id = org?.id;
      if (org) {
        const { error } = await db.from('forum_orgs').update(row).eq('id', org.id);
        if (error) { btn.disabled = false; msg.textContent = error.message; return; }
      } else {
        const { data, error } = await db.from('forum_orgs').insert({ ...row, owner_id: state.me.user_id }).select('id').single();
        if (error) { btn.disabled = false; msg.textContent = error.code === '23505' ? 'You have already registered an organisation.' : error.message; return; }
        id = data.id;
      }
      let certPath = null;
      if (cert) {
        const ext = /\.png$/i.test(cert.name) ? 'png' : /\.jpe?g$/i.test(cert.name) ? 'jpg' : 'pdf';
        certPath = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await db.storage.from('forum-org-docs').upload(certPath, cert, { contentType: ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg', upsert: false });
        if (error) { if (!org) await db.from('forum_orgs').delete().eq('id', id); btn.disabled = false; msg.textContent = 'The certificate could not be uploaded. Please try again.'; return; }
      }
      const priv = { org_id: id };
      if (v('registration_number')) priv.registration_number = v('registration_number');
      if (v('tax_id')) priv.tax_id = v('tax_id');
      if (v('contact_email')) priv.contact_email = v('contact_email');
      if (certPath) priv.certificate_path = certPath;
      if (Object.keys(priv).length > 1) {
        const { error } = org ? await db.from('forum_org_private').update(priv).eq('org_id', id) : await db.from('forum_org_private').insert(priv);
        if (error) { if (!org) await db.from('forum_orgs').delete().eq('id', id); btn.disabled = false; msg.textContent = 'Your verification details could not be saved. Please check them and try again.'; return; }
      }
      F.alertModerators?.('org', id);
      employer(body);
    });
    return f;
  }

  function jobForm(org, body) {
    const msg = status();
    const f = el('form', { class: 'fm-form fm-org-form', novalidate: '' });
    const field = (label, input, hint) => el('label', {}, [label, hint ? el('small', { text: ` ${hint}` }) : null, input]);
    const sel = (name, opts) => el('select', { name }, Object.entries(opts).map(([v, t]) => el('option', { value: v, text: t })));
    const desc = el('textarea', { name: 'description', rows: '8', maxlength: '8000', placeholder: 'Responsibilities, requirements, how you work, benefits…' });
    f.append(
      el('h3', { text: 'Post a job' }),
      field('Job title', el('input', { name: 'title', maxlength: '140' })),
      el('div', { class: 'fm-two' }, [field('Type', sel('employment_type', TYPES)), field('Workplace', sel('workplace', PLACES))]),
      el('div', { class: 'fm-two' }, [field('City / location', el('input', { name: 'location', maxlength: '120' }), '(optional)'), field('Country', el('input', { name: 'country', maxlength: '80' }), '(optional for remote)')]),
      el('div', { class: 'fm-two' }, [field('Pay from', el('input', { name: 'salary_min', type: 'number', min: '0', step: '1' }), '(optional)'), field('Pay to', el('input', { name: 'salary_max', type: 'number', min: '0', step: '1' }), '(optional)')]),
      el('div', { class: 'fm-two' }, [field('Currency', el('input', { name: 'salary_currency', maxlength: '3', value: 'USD' })), field('Per', sel('salary_period', { year: 'Year', month: 'Month', hour: 'Hour', total: 'Total' }))]),
      field('Skills (comma separated)', el('input', { name: 'skills', maxlength: '400', placeholder: 'e.g. Python, M&E, French' }), '(used to match candidates)'),
      field('Apply by', el('input', { name: 'deadline', type: 'date', min: new Date().toISOString().slice(0, 10) }), '(optional)'),
      field('Description', desc, '(at least 50 characters)'),
      el('div', { class: 'fm-actions' }, [el('button', { type: 'submit', class: 'hp-btn hp-btn-primary', text: 'Publish job' }), el('button', { type: 'button', class: 'fm-text-btn', text: 'Cancel', onclick: () => f.remove() })]),
      msg
    );
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = (k) => (f.elements[k]?.value || '').trim();
      if (v('title').length < 3) return void (msg.textContent = 'Add a job title.');
      if (desc.value.trim().length < 50) return void (msg.textContent = 'The description needs at least 50 characters.');
      const seen = new Set();
      const skills = v('skills').split(',').map((s) => s.trim().slice(0, 40)).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase())).slice(0, 15);
      const min = v('salary_min') ? Number(v('salary_min')) : null; const max = v('salary_max') ? Number(v('salary_max')) : null;
      if (min !== null && max !== null && max < min) return void (msg.textContent = '"Pay to" must be at least "Pay from".');
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      const { error } = await db.from('forum_jobs').insert({
        org_id: org.id, title: v('title'), employment_type: v('employment_type'), workplace: v('workplace'), location: v('location') || null, country: v('country') || null,
        salary_min: min, salary_max: max, salary_currency: (v('salary_currency') || 'USD').toUpperCase(), salary_period: v('salary_period'),
        description: desc.value.trim(), skills, deadline: v('deadline') || null
      });
      btn.disabled = false;
      if (error) { msg.textContent = error.message; return; }
      employer(body);
    });
    return f;
  }

  async function applicants(job, slot) {
    slot.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading applicants…' }));
    const { data: apps } = await db.from('forum_job_applications').select('id,applicant_id,cv_path,cv_name,cover_note,status,employer_note,created_at').eq('job_id', job.id).order('created_at', { ascending: false });
    const ids = (apps || []).map((a) => a.applicant_id);
    const { data: profs } = ids.length ? await db.from('forum_profiles').select('user_id,display_name,headline,location,skills').in('user_id', ids) : { data: [] };
    const pm = new Map((profs || []).map((p) => [p.user_id, p]));
    const rows = (apps || []).map((a) => ({ a, p: pm.get(a.applicant_id) || {}, m: matchOf(job.skills, (pm.get(a.applicant_id)?.skills || []).map((s) => s.toLowerCase())) }))
      .sort((x, y) => (y.m || 0) - (x.m || 0));
    slot.replaceChildren(...(rows.length ? rows.map(({ a, p, m }) => {
      const msg = status();
      const st = el('select', { 'aria-label': 'Application stage' }, ['reviewing', 'shortlisted', 'interview', 'offered', 'not_selected'].map((k) => el('option', { value: k, text: STATUS[k] })));
      st.value = ['submitted', 'withdrawn'].includes(a.status) ? 'reviewing' : a.status;
      const note = el('input', { maxlength: '1000', placeholder: 'Private note (optional)', value: a.employer_note || '', 'aria-label': 'Private note' });
      return el('div', { class: `fm-applicant${a.status === 'withdrawn' ? ' is-withdrawn' : ''}` }, [
        el('div', { class: 'fm-admin-card-head' }, [
          el('a', { href: `#profile/${a.applicant_id}` }, [el('strong', { text: p.display_name || 'Member' })]),
          m !== null ? el('span', { class: 'fm-match', text: `${m}% skills match` }) : null
        ]),
        el('p', { class: 'fm-small fm-muted', text: [p.headline, p.location, `applied ${day(a.created_at)}`, STATUS[a.status]].filter(Boolean).join(' · ') }),
        a.cover_note ? el('blockquote', { class: 'fm-admin-quote', text: a.cover_note }) : null,
        a.status === 'withdrawn' ? el('p', { class: 'fm-small', text: 'The applicant withdrew this application.' }) : el('div', { class: 'fm-admin-row' }, [
          el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: `📄 Open CV`, onclick: async () => { const { data: u } = await db.storage.from('forum-cvs').createSignedUrl(a.cv_path, 300); if (u?.signedUrl) window.open(u.signedUrl, '_blank', 'noopener'); else msg.textContent = 'The CV could not be opened.'; } }),
          st, note,
          el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Update', onclick: async () => {
            const { error } = await db.rpc('forum_application_update', { p_id: a.id, p_status: st.value, p_note: note.value });
            msg.textContent = error ? error.message : 'Updated. The applicant gets an alert for shortlist, interview, offer or not selected.';
          } }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Message', onclick: () => F.startMessage?.(a.applicant_id) })
        ]),
        msg
      ]);
    }) : [el('p', { class: 'fm-small fm-muted', text: 'No applications yet.' })]));
  }

  // ---------------------------------------------------------------- organisations directory + page (NGO Partnerships)
  async function renderOrgs() {
    const box = $('[data-fm-orgs]');
    if (!box || !state.me) return;
    let kindF = '';
    const list = el('div', { class: 'fm-org-grid' });
    const run = async (q = '') => {
      let query = db.from('forum_orgs').select('id,name,kind,country,sector,about,status').eq('status', 'verified').order('name').limit(100);
      if (kindF) query = kindF === 'ngo' ? query.in('kind', ['ngo', 'both']) : query.in('kind', ['employer', 'both']);
      if (q) query = query.ilike('name', `%${q.replace(/[%_,()\\]/g, ' ')}%`);
      const { data } = await query;
      list.replaceChildren(...(data?.length ? data.map((o) => el('a', { class: 'fm-org-card', href: `#org/${o.id}` }, [
        logo(o),
        el('span', {}, [el('strong', {}, [o.name, verified(o)]), el('small', { class: 'fm-muted', text: [KINDS[o.kind], o.sector, o.country].filter(Boolean).join(' · ') }),
          o.about ? el('small', { class: 'fm-org-about', text: o.about }) : null])
      ])) : [el('p', { class: 'fm-empty', text: 'No verified organisations yet. Organisations can register under Career Center → For employers.' })]));
    };
    const search = el('input', { type: 'search', placeholder: 'Search organisations', 'aria-label': 'Search organisations', maxlength: '80' });
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => run(search.value.trim()), 350); });
    const chips = el('div', { class: 'fm-chips' }, [['', 'All'], ['ngo', 'NGOs & nonprofits'], ['employer', 'Employers']].map(([k, label]) => {
      const b = el('button', { type: 'button', class: `fm-chip-btn${k === kindF ? ' is-on' : ''}`, text: label });
      b.addEventListener('click', () => { kindF = k; chips.querySelectorAll('.fm-chip-btn').forEach((x) => x.classList.toggle('is-on', x === b)); run(search.value.trim()); });
      return b;
    }));
    box.replaceChildren(
      el('div', { class: 'fm-fund-head' }, [
        el('div', {}, [el('h2', { text: 'NGO Partnerships' }), el('p', { class: 'fm-muted', text: 'Organisations verified by WHSF: registration certificate, official website and tax ID checked. Propose a partnership or find roles.' })]),
        el('a', { class: 'hp-btn hp-btn-outline', href: '#careers/employer', text: 'Register your organisation' })
      ]),
      search, chips, list
    );
    run();
  }

  async function renderOrg(id) {
    const box = $('[data-fm-org]');
    if (!box || !state.me) return;
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading…' }));
    const [{ data: o }, { data: jobs }] = await Promise.all([
      db.from('forum_orgs').select('id,owner_id,name,kind,website,country,sector,about,status,created_at').eq('id', id).maybeSingle(),
      db.from('forum_jobs').select('id,title,employment_type,workplace,location,country,created_at,deadline,status').eq('org_id', id).eq('status', 'open').order('created_at', { ascending: false })
    ]);
    if (!o) { box.replaceChildren(el('a', { class: 'fm-text-btn', href: '#orgs', text: '← Organisations' }), el('p', { text: 'This organisation is not available.' })); return; }
    const mine = o.owner_id === state.me.user_id;
    const propose = el('div');
    box.replaceChildren(
      el('a', { class: 'fm-text-btn', href: '#orgs', text: '← Organisations' }),
      el('div', { class: 'fm-job-top fm-org-head' }, [logo(o), el('div', {}, [
        el('h2', {}, [o.name, verified(o)]),
        el('p', { class: 'fm-muted', text: [KINDS[o.kind], o.sector, o.country].filter(Boolean).join(' · ') }),
        el('a', { href: o.website, target: '_blank', rel: 'noopener noreferrer', text: `${o.website.replace(/^https:\/\//, '')} ↗` }),
        o.status === 'verified' ? el('p', { class: 'fm-small fm-open-chip', text: '✔ Verified by WHSF: registration certificate, website and tax ID' }) : el('p', { class: 'fm-small', text: ORG_STATUS[o.status] })
      ])]),
      o.about ? el('p', { class: 'fm-profile-about', text: o.about }) : null,
      mine ? el('a', { class: 'hp-btn hp-btn-outline', href: '#careers/employer', text: 'Manage your organisation' }) : el('div', { class: 'fm-actions' }, [
        el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: '🤝 Propose a partnership', onclick: () => {
          if (propose.firstChild) return;
          const text = el('textarea', { rows: '4', maxlength: '500', placeholder: 'Describe the partnership: the project, what you bring and what you need from them.', 'aria-label': 'Partnership proposal' });
          const msg = status();
          propose.append(el('div', { class: 'fm-collab-invite' }, [el('strong', { text: `Propose a partnership to ${o.name}` }), text,
            el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Send proposal', onclick: async () => {
              const { error } = await db.rpc('forum_connect', { p_user: o.owner_id, p_kind: 'collaborate', p_message: `Partnership proposal for ${o.name}: ${text.value}`.slice(0, 500) });
              if (error) { msg.textContent = error.message; return; }
              propose.replaceChildren(el('p', { class: 'fm-small', text: `Proposal sent. ${o.name} will get an alert and can accept it under Network → Invitations.` }));
            } }), msg]));
          text.focus();
        } }),
        el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Message', onclick: () => F.startMessage?.(o.owner_id) })
      ]),
      propose,
      el('h3', { class: 'fm-admin-h', text: `Open roles (${(jobs || []).length})` }),
      jobs?.length ? el('div', { class: 'fm-job-list' }, jobs.map((j) => jobCard({ ...j, org: o }, null))) : el('p', { class: 'fm-small fm-muted', text: 'No open roles right now.' })
    );
  }

  F.hooks.refresh.push(() => { myOrg = undefined; if (state.me) state.me.skills = undefined; });
  F.hooks.view.push((view) => {
    const id = (location.hash || '').split('/')[1];
    if (view === 'careers') renderCareers();
    if (view === 'job') renderJob(id);
    if (view === 'orgs') renderOrgs();
    if (view === 'org') renderOrg(id);
  });
})();
