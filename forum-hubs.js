// WHSF Forum 2.0 add-on: the eight hubs (My Network, Career Center, Grants & Scholarships, Global Events,
// NGO Partnerships, MIL Lab, Mentorship, Impact Dashboard), the "Get started" journey for new members,
// and the Funding finder (#funding) with filters and official-source links.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = (paths) => {
    const s = document.createElementNS(svgNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    paths.forEach(([tag, attrs]) => { const n = document.createElementNS(svgNS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); s.append(n); });
    return s;
  };
  const P = (d) => ['path', { d }];
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
  };

  // ---------------------------------------------------------------- hubs
  const HUBS = [
    { key: 'network', name: 'My Network', about: 'Members, connections and messages', go: () => { location.hash = '#people'; },
      icon: [P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'), ['circle', { cx: '9', cy: '7', r: '4' }], P('M22 21v-2a4 4 0 0 0-3-3.87'), P('M16 3.13a4 4 0 0 1 0 7.75')] },
    { key: 'career', name: 'Career Center', about: 'Jobs, internships and career advice', go: () => F.setTopic('jobs'),
      icon: [['rect', { x: '2', y: '7', width: '20', height: '14', rx: '2' }], P('M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'), P('M2 13h20')] },
    { key: 'grants', name: 'Grants & Scholarships', about: 'Open funding with official links', go: () => { location.hash = '#funding'; },
      icon: [P('M22 10 12 5 2 10l10 5 10-5z'), P('M6 12v5c3 2 9 2 12 0v-5')] },
    { key: 'events', name: 'Global Events', about: 'Side events, summits and webinars', go: () => { location.hash = '#events'; },
      icon: [['rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }], P('M16 2v4M8 2v4M3 10h18'), P('M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01')] },
    { key: 'ngo', name: 'NGO Partnerships', about: 'NGOs, partners and collaboration', go: () => F.setTopic('ngos'),
      icon: [P('m11 17 2 2a1 1 0 1 0 3-3'), P('m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4'), P('m21 3 1 11h-2'), P('M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3'), P('M3 4h8')] },
    { key: 'mil', name: 'MIL Lab', about: 'Media literacy and fact-checking', go: () => F.setTopic('media_literacy'),
      icon: [P('M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'), P('m9 9.5 2 2 4-4')] },
    { key: 'mentorship', name: 'Mentorship', about: 'Find a mentor or become one', go: () => F.setTopic('mentorship'),
      icon: [P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'), ['circle', { cx: '9', cy: '7', r: '4' }], P('m16 11 2 2 4-4')] },
    { key: 'impact', name: 'Impact Dashboard', about: 'WHSF results, live', go: () => { window.open('impact-dashboard.html', '_blank', 'noopener'); },
      icon: [P('M3 3v18h18'), P('m19 9-5 5-4-4-3 3')] }
  ];
  function hubsCard() {
    return el('section', { class: 'fm-card fm-hubs', 'aria-label': 'WHSF Forum hubs' }, [
      el('div', { class: 'fm-hubs-grid' }, HUBS.map((h) => el('button', { type: 'button', class: 'fm-hub', onclick: h.go }, [
        el('span', { class: 'fm-hub-icon' }, [icon(h.icon)]),
        el('strong', { text: h.name }),
        el('small', { text: h.about })
      ]))),
      el('a', { class: 'fm-text-btn fm-hubs-more', href: '#spaces', text: 'Browse all spaces →' })
    ]);
  }

  // ---------------------------------------------------------------- get started (first-time journey)
  const INTERESTS = [
    ['education', 'Education'], ['digital_skills', 'Digital skills'], ['stem', 'STEM'], ['ai', 'AI'], ['youth', 'Youth'],
    ['women_girls', 'Women & girls'], ['health', 'Health'], ['climate', 'Climate'], ['agriculture', 'Agriculture'],
    ['humanitarian', 'Humanitarian'], ['economic_development', 'Economic development'], ['media_literacy', 'Media literacy'],
    ['peacebuilding', 'Peacebuilding'], ['entrepreneurship', 'Entrepreneurship']
  ];
  const DISMISS_KEY = 'whsf-forum-getstarted-done';
  let myInterests = []; let mySpaces = new Set(); let savedIds = new Set();

  async function loadMine() {
    if (!state.me) return;
    const [{ data: prof }, { data: spaces }, { data: saved }] = await Promise.all([
      db.from('forum_profiles').select('interests').eq('user_id', state.me.user_id).maybeSingle(),
      db.from('forum_space_members').select('space'),
      db.from('forum_saved_opportunities').select('opportunity_id')
    ]);
    myInterests = prof?.interests || [];
    mySpaces = new Set((spaces || []).map((s) => s.space));
    savedIds = new Set((saved || []).map((s) => s.opportunity_id));
  }

  function steps() {
    const me = state.me || {};
    return [
      { key: 'profile', title: 'Complete your profile', text: 'Add a photo, headline, location and a short bio so members know who you are.',
        done: Boolean(me.avatar_url && me.headline && me.location && me.about), action: ['Edit profile', () => { location.hash = '#me'; }] },
      { key: 'interests', title: 'Choose your interests', text: 'Pick the topics you care about. We use them to suggest people and opportunities.',
        done: myInterests.length > 0, action: ['Choose interests', (card) => openInterests(card)] },
      { key: 'spaces', title: 'Join spaces', text: 'Spaces are communities around a topic: jobs, grants, mentorship, MIL Lab and more.',
        done: mySpaces.size > 0, action: ['Join spaces', (card) => openSpaces(card)] },
      { key: 'connect', title: 'Connect with 3 members', text: 'Follow people whose work interests you. Following each other makes you connections.',
        done: state.following.size >= 3, action: ['Find people', () => { location.hash = '#people'; }] },
      { key: 'discover', title: 'Discover opportunities', text: 'Save a grant or scholarship that fits you. Every listing links to its official source.',
        done: savedIds.size > 0, action: ['Find funding', () => { location.hash = '#funding'; }] }
    ];
  }

  function getStartedCard() {
    const list = steps();
    const done = list.filter((s) => s.done).length;
    if (done === list.length || store.get(DISMISS_KEY) === '1') return null;
    const card = el('section', { class: 'fm-card fm-start', 'aria-labelledby': 'fm-start-title' });
    const next = list.find((s) => !s.done);
    card.append(
      el('div', { class: 'fm-start-head' }, [
        el('div', {}, [el('h2', { id: 'fm-start-title', text: 'Get started on the WHSF Forum' }), el('p', { class: 'fm-muted', text: `${done} of ${list.length} steps done` })]),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Hide', onclick: () => { store.set(DISMISS_KEY, '1'); card.remove(); } })
      ]),
      el('div', { class: 'fm-meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(list.length), 'aria-valuenow': String(done) }, [el('i', { style: `width:${(done / list.length) * 100}%` })]),
      el('ol', { class: 'fm-start-steps' }, list.map((s) => el('li', { class: s.done ? 'is-done' : (s === next ? 'is-next' : '') }, [
        el('span', { class: 'fm-start-mark', 'aria-hidden': 'true', text: s.done ? '✓' : String(list.indexOf(s) + 1) }),
        el('div', {}, [
          el('strong', { text: s.title }),
          s.done ? null : el('small', { text: s.text })
        ]),
        s.done ? el('span', { class: 'sr-only', text: 'Done' }) : el('button', { class: s === next ? 'hp-btn hp-btn-primary' : 'fm-text-btn', type: 'button', text: s.action[0], onclick: () => s.action[1](card) })
      ]))),
      el('div', { class: 'fm-start-panel', 'data-fm-start-panel': '', hidden: '' })
    );
    return card;
  }
  const panelOf = (card) => card.querySelector('[data-fm-start-panel]');
  function chipPicker(items, chosen, onSave, saveText) {
    const picked = new Set(chosen);
    const status = el('p', { class: 'fm-status', role: 'status' });
    const chips = el('div', { class: 'fm-chips' }, items.map(([k, label]) => {
      const b = el('button', { type: 'button', class: `fm-chip-btn${picked.has(k) ? ' is-on' : ''}`, 'aria-pressed': String(picked.has(k)), text: label });
      b.addEventListener('click', () => { if (picked.has(k)) picked.delete(k); else picked.add(k); b.classList.toggle('is-on'); b.setAttribute('aria-pressed', String(picked.has(k))); });
      return b;
    }));
    const save = el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: saveText, onclick: async () => {
      if (!picked.size) { status.textContent = 'Choose at least one.'; return; }
      save.disabled = true; status.textContent = 'Saving…';
      const error = await onSave([...picked]);
      save.disabled = false;
      status.textContent = error ? 'Could not save. Please try again.' : '';
      if (!error) render();
    } });
    return [chips, el('div', { class: 'fm-actions' }, [save]), status];
  }
  function openInterests(card) {
    const p = panelOf(card); p.hidden = false;
    p.replaceChildren(el('strong', { text: 'What are you interested in?' }), ...chipPicker(INTERESTS, myInterests, async (list) => {
      const { error } = await db.from('forum_profiles').update({ interests: list }).eq('user_id', state.me.user_id);
      if (!error) myInterests = list;
      return error;
    }, 'Save interests'));
  }
  function openSpaces(card) {
    const p = panelOf(card); p.hidden = false;
    p.replaceChildren(el('strong', { text: 'Which spaces would you like to join?' }), ...chipPicker(F.SPACES.map((s) => [s.key, `${s.emoji} ${s.name}`]), [...mySpaces], async (list) => {
      const add = list.filter((k) => !mySpaces.has(k)).map((space) => ({ user_id: state.me.user_id, space }));
      const remove = [...mySpaces].filter((k) => !list.includes(k));
      if (add.length) { const { error } = await db.from('forum_space_members').insert(add); if (error) return error; }
      if (remove.length) { const { error } = await db.from('forum_space_members').delete().eq('user_id', state.me.user_id).in('space', remove); if (error) return error; }
      mySpaces = new Set(list);
      return null;
    }, 'Join spaces'));
  }

  // ---------------------------------------------------------------- render on the Home feed
  async function render() {
    const slot = $('[data-fm-hubs-slot]');
    if (!slot) return;
    const plainFeed = ((location.hash || '#feed').replace('#', '') === 'feed' || !location.hash) && !state.topic;
    if (!state.me || !plainFeed || state.q) { slot.replaceChildren(); return; }
    await loadMine();
    slot.replaceChildren(...[getStartedCard(), hubsCard()].filter(Boolean));
  }
  F.hooks.refresh.push(render);
  F.hooks.view.push((view) => { if (view === 'feed') render(); else $('[data-fm-hubs-slot]')?.replaceChildren(); if (view === 'funding') renderFunding(); });

  // ---------------------------------------------------------------- funding finder (#funding)
  const SECTOR_LABEL = { education: 'Education', ict: 'Digital / ICT', stem: 'STEM', youth: 'Youth', economic_development: 'Economic development', health: 'Health', ai: 'AI', climate: 'Climate', agriculture: 'Agriculture', humanitarian: 'Humanitarian' };
  const WHO_LABEL = { any: 'Anyone', individual: 'Individuals', nonprofit: 'Nonprofits / NGOs', us_nonprofit: 'US nonprofits', university: 'Universities', school: 'Schools', business: 'Businesses', government: 'Government', other: 'Other organisations' };
  const SOURCE_LABEL = { grants_gov: 'Grants.gov (US Government)', eu: 'EU Funding & Tenders', manual: 'WHSF verified' };
  const COUNTRY = (c) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch { return c; } };
  const nice = (map, k) => map[k] || String(k).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const money = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const COLS = 'id,title,funder_name,summary,url,countries,sectors,applicant_types,amount_min_usd,amount_max_usd,amount_note,deadline,source';
  const filters = { q: '', sector: '', who: '', country: '', amount: '', due: '', source: '', saved: false };
  let facets = null; let offset = 0;

  async function loadFacets() {
    if (facets) return facets;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await db.from('whsf_opportunities').select('countries,sectors,applicant_types,source')
      .eq('kind', 'grant').eq('review_status', 'published').neq('status', 'closed').gte('deadline', today).limit(1000);
    const count = (key) => { const m = new Map(); (data || []).forEach((r) => [].concat(r[key] || []).forEach((v) => m.set(v, (m.get(v) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    facets = { sectors: count('sectors'), who: count('applicant_types'), countries: count('countries'), sources: count('source'), total: (data || []).length };
    return facets;
  }

  async function renderFunding() {
    const box = $('[data-fm-funding]');
    if (!box || !state.me) return;
    await loadMine();
    const f = await loadFacets();
    const select = (name, label, options) => {
      const s = el('select', { name, 'aria-label': label }, [el('option', { value: '', text: label }), ...options.map(([v, t]) => el('option', { value: v, text: t }))]);
      s.value = filters[name];
      s.addEventListener('change', () => { filters[name] = s.value; offset = 0; runSearch(); });
      return s;
    };
    const q = el('input', { type: 'search', name: 'q', maxlength: '80', placeholder: 'Search title or funder', 'aria-label': 'Search funding' });
    q.value = filters.q;
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { filters.q = q.value.trim(); offset = 0; runSearch(); }, 350); });
    const savedBtn = el('button', { type: 'button', class: `fm-chip-btn${filters.saved ? ' is-on' : ''}`, 'aria-pressed': String(filters.saved), text: `🔖 Saved (${savedIds.size})`, onclick: () => { filters.saved = !filters.saved; offset = 0; renderFunding(); } });
    box.replaceChildren(
      el('div', { class: 'fm-fund-head' }, [
        el('div', {}, [
          el('h2', { text: 'Grants & Scholarships' }),
          el('p', { class: 'fm-muted', text: `${f.total} open opportunities from official sources. Always apply on the funder's own website: WHSF never charges fees and never asks for bank details.` })
        ]),
        el('a', { class: 'fm-text-btn', href: 'grants-account.html', target: '_blank', rel: 'noopener', text: 'Deadline reminders by email →' })
      ]),
      el('div', { class: 'fm-fund-filters' }, [
        q,
        select('sector', 'All sectors', f.sectors.map(([k, n]) => [k, `${nice(SECTOR_LABEL, k)} (${n})`])),
        select('who', 'Who can apply', f.who.map(([k, n]) => [k, `${nice(WHO_LABEL, k)} (${n})`])),
        select('country', 'Any country', f.countries.map(([k, n]) => [k, `${COUNTRY(k)} (${n})`])),
        select('amount', 'Any amount', [['50000', '$50,000 or more'], ['250000', '$250,000 or more'], ['1000000', '$1 million or more']]),
        select('due', 'Any deadline', [['14', 'Closes within 2 weeks'], ['30', 'Closes within 30 days'], ['90', 'Closes within 3 months']]),
        select('source', 'All sources', f.sources.map(([k, n]) => [k, `${nice(SOURCE_LABEL, k)} (${n})`])),
        savedBtn
      ]),
      el('div', { class: 'fm-fund-results', 'data-fm-fund-results': '' }),
      el('p', { class: 'fm-small fm-muted', text: 'Opportunities come from official funder databases and are checked by WHSF before they are listed. Eligibility and amounts can change: confirm on the official page before applying.' })
    );
    runSearch();
  }

  async function runSearch(append = false) {
    const out = $('[data-fm-fund-results]');
    if (!out) return;
    if (!append) out.replaceChildren(el('p', { class: 'fm-muted', text: 'Searching…' }));
    const today = new Date().toISOString().slice(0, 10);
    let query = db.from('whsf_opportunities').select(COLS).eq('kind', 'grant').eq('review_status', 'published').neq('status', 'closed').gte('deadline', today);
    if (filters.saved) query = query.in('id', [...savedIds, '00000000-0000-0000-0000-000000000000']);
    if (filters.q) { const like = `%${filters.q.replace(/[%_,()\\]/g, ' ')}%`; query = query.or(`title.ilike.${like},funder_name.ilike.${like}`); }
    if (filters.sector) query = query.contains('sectors', [filters.sector]);
    if (filters.who) query = query.contains('applicant_types', [filters.who]);
    if (filters.country) query = query.contains('countries', [filters.country]);
    if (filters.amount) query = query.gte('amount_max_usd', Number(filters.amount));
    if (filters.due) query = query.lte('deadline', new Date(Date.now() + Number(filters.due) * 86400000).toISOString().slice(0, 10));
    if (filters.source) query = query.eq('source', filters.source);
    const { data, error } = await query.order('deadline', { ascending: true }).range(offset, offset + 19);
    if (!append) out.replaceChildren();
    out.querySelector('.fm-more')?.remove();
    if (error) { out.append(el('p', { class: 'fm-muted', text: 'Opportunities could not be loaded. Please try again.' })); return; }
    if (!append && !data.length) { out.append(el('p', { class: 'fm-empty', text: filters.saved ? 'You have not saved any opportunities yet.' : 'No open opportunities match these filters. Try fewer filters.' })); return; }
    data.forEach((o) => out.append(oppCard(o)));
    if (data.length === 20) out.append(el('button', { class: 'fm-more', type: 'button', text: 'Show more', onclick: () => { offset += 20; runSearch(true); } }));
  }

  function oppCard(o) {
    const official = typeof o.url === 'string' && /^https:\/\/\S+$/.test(o.url) ? o.url : null;
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(`${o.deadline}T00:00:00`) - today0) / 86400000);
    const due = new Date(`${o.deadline}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const amount = o.amount_max_usd ? `${o.amount_min_usd && o.amount_min_usd !== o.amount_max_usd ? `${money(o.amount_min_usd)} – ` : 'Up to '}${money(o.amount_max_usd)}` : (o.amount_note || 'Amount: see official page');
    const saved = savedIds.has(o.id);
    const saveBtn = el('button', { class: `fm-chip-btn${saved ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(saved), text: saved ? '🔖 Saved' : '🔖 Save', onclick: async () => {
      saveBtn.disabled = true;
      const on = !savedIds.has(o.id);
      const { error } = on
        ? await db.from('forum_saved_opportunities').insert({ user_id: state.me.user_id, opportunity_id: o.id })
        : await db.from('forum_saved_opportunities').delete().eq('user_id', state.me.user_id).eq('opportunity_id', o.id);
      saveBtn.disabled = false;
      if (error) return;
      if (on) savedIds.add(o.id); else savedIds.delete(o.id);
      saveBtn.classList.toggle('is-on', on); saveBtn.setAttribute('aria-pressed', String(on)); saveBtn.textContent = on ? '🔖 Saved' : '🔖 Save';
      const sb = $('.fm-fund-filters .fm-chip-btn'); if (sb) sb.textContent = `🔖 Saved (${savedIds.size})`;
    } });
    return el('article', { class: 'fm-opp' }, [
      el('div', { class: 'fm-opp-top' }, [
        el('span', { class: `fm-opp-due${days <= 14 ? ' is-soon' : ''}`, text: days <= 0 ? 'Closes today' : days === 1 ? `Closes tomorrow · ${due}` : `Closes ${due} · ${days} days left` }),
        el('span', { class: 'fm-opp-src', text: nice(SOURCE_LABEL, o.source) })
      ]),
      el('h3', { text: o.title }),
      el('p', { class: 'fm-opp-funder', text: `${o.funder_name || 'Funder'} · ${amount}` }),
      o.summary ? el('p', { class: 'fm-opp-sum', text: o.summary.length > 260 ? `${o.summary.slice(0, 257)}…` : o.summary }) : null,
      el('div', { class: 'fm-opp-tags' }, [
        ...(o.sectors || []).slice(0, 3).map((s) => el('span', { text: nice(SECTOR_LABEL, s) })),
        ...(o.applicant_types || []).slice(0, 2).map((s) => el('span', { class: 'is-who', text: nice(WHO_LABEL, s) })),
        ...(o.countries || []).slice(0, 2).map((c) => el('span', { class: 'is-where', text: COUNTRY(c) }))
      ]),
      el('div', { class: 'fm-opp-actions' }, [
        official ? el('a', { class: 'hp-btn hp-btn-primary', href: official, target: '_blank', rel: 'noopener noreferrer', text: 'Official source ↗' }) : el('span', { class: 'fm-muted', text: 'Official link coming soon' }),
        saveBtn
      ])
    ]);
  }
})();
