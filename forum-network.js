// WHSF Forum add-on: professional profiles and networking.
// #profile/<id>: full profile (about, open to, skills, experience, portfolio, interests) with Connect / Accept /
// Message / Invite to collaborate. #people (#network/<tab>): Suggestions, Invitations, Connections, All members.
// Me: professional profile editor. All rules live in the database (forum_connect*, forum_people_suggestions).
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar } = F;
  const OPEN_TO = {
    mentoring: 'Mentoring others', being_mentored: 'Finding a mentor', collaboration: 'Collaboration', jobs: 'Job opportunities',
    hiring: 'Hiring', volunteering: 'Volunteering', speaking: 'Speaking', partnerships: 'Partnerships'
  };
  const INTERESTS = {
    education: 'Education', digital_skills: 'Digital skills', stem: 'STEM', ai: 'AI', youth: 'Youth', women_girls: 'Women & girls', health: 'Health',
    climate: 'Climate', agriculture: 'Agriculture', humanitarian: 'Humanitarian', economic_development: 'Economic development',
    media_literacy: 'Media literacy', peacebuilding: 'Peacebuilding', entrepreneurship: 'Entrepreneurship'
  };
  const PRO_COLS = 'user_id,display_name,headline,location,about,avatar_url,interests,skills,experience,portfolio,open_to,created_at,verification_status';
  const ym = (v) => {
    if (!v) return '';
    const [y, m] = v.split('-');
    return m ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : y;
  };
  const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/\S+$/.test(u) ? u : null);
  const status = () => el('p', { class: 'fm-status', role: 'status' });

  // My connection rows (both directions) for button states.
  async function myRelations() {
    const { data } = await db.from('forum_connections').select('id,requester_id,addressee_id,kind,status,message,created_at')
      .or(`requester_id.eq.${state.me.user_id},addressee_id.eq.${state.me.user_id}`).order('created_at', { ascending: false }).limit(500);
    return data || [];
  }
  const otherOf = (c) => (c.requester_id === state.me.user_id ? c.addressee_id : c.requester_id);
  function relationTo(rows, userId) {
    const c = rows.find((r) => r.kind === 'connect' && otherOf(r) === userId);
    if (!c) return { state: 'none' };
    if (c.status === 'accepted') return { state: 'connected', c };
    if (c.status === 'pending') return { state: c.requester_id === state.me.user_id ? 'sent' : 'received', c };
    return { state: 'none', c };
  }

  // Connect button that knows the current state (Connect / Pending / Accept / Connected).
  function connectButton(userId, rel, after) {
    const msg = status();
    const run = async (fn) => { const { error } = await fn(); if (error) msg.textContent = error.message; else after(); };
    const btn = {
      none: el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: '+ Connect', onclick: () => run(() => db.rpc('forum_connect', { p_user: userId, p_kind: 'connect', p_message: null })) }),
      sent: el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Pending · Withdraw', onclick: () => run(() => db.rpc('forum_connect_remove', { p_user: userId })) }),
      received: el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: '✓ Accept request', onclick: () => run(() => db.rpc('forum_connect_respond', { p_id: rel.c.id, p_accept: true })) }),
      connected: el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: '✓ Connected', title: 'Remove connection', onclick: (e) => {
        const b = e.currentTarget;
        if (b.dataset.confirm) { run(() => db.rpc('forum_connect_remove', { p_user: userId })); return; }
        b.dataset.confirm = '1'; b.textContent = 'Remove connection?';
        setTimeout(() => { if (b.isConnected) { delete b.dataset.confirm; b.textContent = '✓ Connected'; } }, 4000);
      } })
    }[rel.state];
    return { btn, msg };
  }

  function collabInvite(userId, name, anchor) {
    if (anchor.querySelector('.fm-collab-invite')) return;
    const text = el('textarea', { rows: '3', maxlength: '500', placeholder: `What would you like to work on with ${name}? (e.g. co-write a grant, run a workshop, joint research)`, 'aria-label': 'Collaboration idea' });
    const msg = status();
    const box = el('div', { class: 'fm-collab-invite' }, [
      el('strong', { text: `Invite ${name} to collaborate` }), text,
      el('div', { class: 'fm-actions' }, [
        el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Send invitation', onclick: async () => {
          const { error } = await db.rpc('forum_connect', { p_user: userId, p_kind: 'collaborate', p_message: text.value });
          if (error) { msg.textContent = error.message; return; }
          box.replaceChildren(el('p', { class: 'fm-small', text: `Invitation sent. ${name} will get an alert.` }));
        } }),
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Cancel', onclick: () => box.remove() })
      ]),
      msg
    ]);
    anchor.append(box);
    text.focus();
  }

  // ---------------------------------------------------------------- profile page
  async function renderProfile(id) {
    const box = $('[data-fm-profile-page]');
    if (!box || !state.me) return;
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading profile…' }));
    const [{ data: p }, rows, { data: count }, { data: spaces }, { count: milDone }, { data: checkerRow }] = await Promise.all([
      db.from('forum_profiles').select(PRO_COLS).eq('user_id', id).maybeSingle(),
      myRelations(),
      db.rpc('forum_connection_count', { p_user: id }),
      db.from('forum_space_members').select('space').eq('user_id', id),
      db.from('forum_mil_progress').select('module', { count: 'exact', head: true }).eq('user_id', id),
      db.from('forum_factcheckers').select('user_id').eq('user_id', id).maybeSingle()
    ]);
    if (!p) { box.replaceChildren(el('p', { text: 'This member is not available.' }), el('a', { class: 'fm-text-btn', href: '#people', text: '← Network' })); return; }
    const mine = id === state.me.user_id;
    const rel = relationTo(rows, id);
    const avatar = el('div', { class: 'fm-avatar fm-avatar-xl', 'aria-hidden': 'true' }); fillAvatar(avatar, p);
    const actions = el('div', { class: 'fm-actions fm-profile-actions' });
    if (mine) actions.append(el('a', { class: 'hp-btn hp-btn-outline', href: '#me', text: '✏️ Edit profile' }));
    else {
      const { btn, msg } = connectButton(id, rel, () => renderProfile(id));
      actions.append(btn,
        el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Message', onclick: () => F.startMessage?.(id) }),
        el('button', { type: 'button', class: 'fm-text-btn', text: '🤝 Invite to collaborate', onclick: () => collabInvite(id, p.display_name, head) }),
        msg);
      if (rel.state === 'received' && rel.c.message) actions.append(el('p', { class: 'fm-small fm-muted', text: `Their note: “${rel.c.message}”` }));
    }
    const head = el('section', { class: 'fm-profile-head' }, [
      el('div', { class: 'fm-profile-cover', 'aria-hidden': 'true' }),
      el('div', { class: 'fm-profile-main' }, [
        avatar,
        el('div', { class: 'fm-profile-id' }, [
          el('h2', {}, [p.display_name, el('span', { class: 'fm-verified', title: 'ID verified by WHSF', text: ' ✔' })]),
          p.headline ? el('p', { class: 'fm-profile-headline', text: p.headline }) : null,
          milDone >= 6 || checkerRow ? el('div', { class: 'fm-pbadges' }, [
            milDone >= 6 ? el('a', { class: 'fm-pbadge is-mil', href: '#mil/learn', title: 'Completed all six WHSF MIL Lab modules', text: '🎓 MIL Ambassador' }) : null,
            checkerRow ? el('a', { class: 'fm-pbadge is-checker', href: '#mil', title: 'Appointed by WHSF to answer fact-check requests', text: '🔎 WHSF Fact-checker' }) : null
          ].filter(Boolean)) : null,
          el('p', { class: 'fm-muted fm-small', text: [p.location ? `📍 ${p.location}` : null, `${count || 0} connection${count === 1 ? '' : 's'}`, `Member since ${new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`].filter(Boolean).join(' · ') }),
          p.open_to?.length ? el('div', { class: 'fm-open-to' }, [el('span', { class: 'fm-open-label', text: 'Open to' }), ...p.open_to.map((k) => el('span', { class: 'fm-open-chip', text: OPEN_TO[k] || k }))]) : null
        ])
      ]),
      actions
    ]);
    const sec = (title, ...kids) => el('section', { class: 'fm-profile-sec' }, [el('h3', { text: title }), ...kids]);
    const exp = Array.isArray(p.experience) ? p.experience : [];
    const port = Array.isArray(p.portfolio) ? p.portfolio : [];
    const sp = (spaces || []).map((s) => F.SPACES.find((x) => x.key === s.space)).filter(Boolean);
    box.replaceChildren(...[
      el('a', { class: 'fm-text-btn', href: '#people', text: '← Network' }),
      head,
      p.about ? sec('About', el('p', { class: 'fm-profile-about', text: p.about })) : (mine ? sec('About', el('p', { class: 'fm-muted', text: 'Add a short bio under Me so members know who you are.' })) : null),
      p.skills?.length ? sec('Skills', el('div', { class: 'fm-opp-tags fm-skill-tags' }, p.skills.map((s) => el('span', { text: s })))) : null,
      exp.length ? sec('Experience', el('ol', { class: 'fm-exp' }, exp.map((x) => el('li', {}, [
        el('strong', { text: x.title }),
        x.org ? el('span', { text: x.org }) : null,
        (x.start || x.end) ? el('small', { class: 'fm-muted', text: `${ym(x.start) || '?'} – ${x.end ? ym(x.end) : 'Present'}` }) : null,
        x.about ? el('p', { text: x.about }) : null
      ])))) : null,
      port.length ? sec('Portfolio', el('ul', { class: 'fm-space-list fm-portfolio' }, port.map((x) => el('li', {}, [
        safeUrl(x.url) ? el('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: `${x.title} ↗` }) : el('strong', { text: x.title }),
        x.about ? el('small', { class: 'fm-muted', text: x.about }) : null
      ])))) : null,
      p.interests?.length ? sec('Interests', el('div', { class: 'fm-opp-tags' }, p.interests.map((k) => el('span', { text: INTERESTS[k] || k })))) : null,
      sp.length ? sec('Spaces', el('div', { class: 'fm-opp-tags' }, sp.map((s) => el('a', { class: 'fm-chip-link', href: `#space/${s.key}`, text: `${s.emoji} ${s.name}` })))) : null
    ].filter(Boolean));
  }

  // ---------------------------------------------------------------- network tabs on #people / #network/<tab>
  const TABS = [['suggestions', 'Suggestions'], ['invitations', 'Invitations'], ['connections', 'Connections'], ['all', 'All members']];
  async function renderNetwork() {
    const view = $('[data-fm-view="people"]');
    if (!view || !state.me) return;
    const parts = (location.hash || '').slice(1).split('/');
    const tab = parts[0] === 'network' && TABS.some(([k]) => k === parts[1]) ? parts[1] : 'suggestions';
    let bar = view.querySelector('.fm-net-tabs');
    let panel = view.querySelector('.fm-net-panel');
    if (!bar) {
      bar = el('nav', { class: 'fm-net-tabs fm-admin-tabs', 'aria-label': 'Network' });
      panel = el('div', { class: 'fm-net-panel' });
      view.querySelector('h2').after(bar, panel);
    }
    const rows = await myRelations();
    const incoming = rows.filter((r) => r.addressee_id === state.me.user_id && r.status === 'pending');
    bar.replaceChildren(...TABS.map(([k, t]) => {
      const a = el('a', { href: `#network/${k}`, class: `fm-admin-tab${k === tab ? ' is-on' : ''}`, text: k === 'invitations' && incoming.length ? `${t} (${incoming.length})` : t });
      if (k === tab) a.setAttribute('aria-current', 'page');
      return a;
    }));
    const list = view.querySelector('[data-fm-people]');
    const intro = view.querySelector('h2 ~ p.fm-muted');
    list.hidden = tab !== 'all'; if (intro) intro.hidden = tab !== 'all';
    panel.hidden = tab === 'all';
    if (tab === 'all') return;
    panel.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading…' }));
    if (tab === 'suggestions') return suggestions(panel);
    if (tab === 'invitations') return invitations(panel, rows);
    return connections(panel, rows);
  }

  const personCard = (p, extra) => {
    const a = el('div', { class: 'fm-avatar fm-avatar-lg', 'aria-hidden': 'true' }); fillAvatar(a, p);
    return el('article', { class: 'fm-net-card' }, [
      el('a', { class: 'fm-net-who', href: `#profile/${p.user_id}` }, [a, el('span', {}, [el('strong', { text: p.display_name }), el('small', { text: p.headline || p.location || 'WHSF Forum member' })])]),
      ...extra
    ]);
  };
  async function profilesFor(ids) {
    if (!ids.length) return new Map();
    const { data } = await db.from('forum_profiles').select('user_id,display_name,headline,location,avatar_url').in('user_id', ids);
    return new Map((data || []).map((p) => [p.user_id, p]));
  }

  async function suggestions(panel) {
    const { data, error } = await db.rpc('forum_people_suggestions', { p_limit: 24 });
    if (error) { panel.replaceChildren(el('p', { class: 'fm-muted', text: 'Suggestions could not be loaded.' })); return; }
    panel.replaceChildren(
      el('p', { class: 'fm-small fm-muted', text: 'Based on your interests, skills, spaces, location and mutual connections. Add skills and interests under Me for better suggestions.' }),
      data?.length ? el('div', { class: 'fm-net-grid' }, data.map((p) => {
        const { btn, msg } = connectButton(p.user_id, { state: 'none' }, () => { btn.replaceWith(el('span', { class: 'fm-small fm-muted', text: 'Request sent ✓' })); });
        return personCard(p, [el('small', { class: 'fm-net-reason', text: p.reason }), btn, msg]);
      })) : el('p', { class: 'fm-empty', text: 'No suggestions right now. Join spaces and add interests to meet more people.' })
    );
  }

  async function invitations(panel, rows) {
    const incoming = rows.filter((r) => r.addressee_id === state.me.user_id && r.status === 'pending');
    const sent = rows.filter((r) => r.requester_id === state.me.user_id && r.status === 'pending');
    const people = await profilesFor([...incoming, ...sent].map(otherOf));
    const respond = async (c, accept, card) => {
      const { error } = await db.rpc('forum_connect_respond', { p_id: c.id, p_accept: accept });
      if (error) { card.append(el('p', { class: 'fm-status', text: error.message })); return; }
      card.replaceChildren(el('p', { class: 'fm-small', text: accept ? (c.kind === 'connect' ? 'Connected ✓' : 'Accepted ✓ Send them a message to start.') : 'Declined.' }),
        accept && c.kind === 'collaborate' ? el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Message', onclick: () => F.startMessage?.(c.requester_id) }) : null);
      renderBadge();
    };
    panel.replaceChildren(
      el('h3', { class: 'fm-admin-h', text: `Waiting for you (${incoming.length})` }),
      incoming.length ? el('div', { class: 'fm-net-grid' }, incoming.map((c) => {
        const p = people.get(otherOf(c)) || { user_id: otherOf(c), display_name: 'Member' };
        const card = personCard(p, [
          el('small', { class: 'fm-net-reason', text: c.kind === 'collaborate' ? '🤝 Invites you to collaborate' : 'Wants to connect' }),
          c.message ? el('p', { class: 'fm-net-note', text: `“${c.message}”` }) : null,
          el('div', { class: 'fm-actions' }, [
            el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Accept', onclick: () => respond(c, true, card) }),
            el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Decline', onclick: () => respond(c, false, card) })
          ])
        ].filter(Boolean));
        return card;
      })) : el('p', { class: 'fm-empty', text: 'No invitations waiting.' }),
      el('h3', { class: 'fm-admin-h', text: `Sent (${sent.length})` }),
      sent.length ? el('div', { class: 'fm-net-grid' }, sent.map((c) => {
        const p = people.get(otherOf(c)) || { user_id: otherOf(c), display_name: 'Member' };
        const card = personCard(p, [
          el('small', { class: 'fm-net-reason', text: c.kind === 'collaborate' ? '🤝 Collaboration invitation · waiting' : 'Connection request · waiting' }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Withdraw', onclick: async () => {
            await db.rpc('forum_connect_remove', { p_user: otherOf(c) }); card.remove();
          } })
        ]);
        return card;
      })) : el('p', { class: 'fm-small fm-muted', text: 'Nothing sent.' })
    );
  }

  async function connections(panel, rows) {
    const mine = rows.filter((r) => r.kind === 'connect' && r.status === 'accepted');
    const people = await profilesFor(mine.map(otherOf));
    panel.replaceChildren(
      el('h3', { class: 'fm-admin-h', text: `${mine.length} connection${mine.length === 1 ? '' : 's'}` }),
      mine.length ? el('div', { class: 'fm-net-grid' }, mine.map((c) => {
        const p = people.get(otherOf(c)) || { user_id: otherOf(c), display_name: 'Member' };
        return personCard(p, [el('div', { class: 'fm-actions' }, [
          el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Message', onclick: () => F.startMessage?.(p.user_id) }),
          el('a', { class: 'fm-text-btn', href: `#profile/${p.user_id}`, text: 'View profile' })
        ])]);
      })) : el('p', { class: 'fm-empty', text: 'No connections yet. Start with your suggestions.' })
    );
  }

  // Badge on the Network tab + connections count on my profile card.
  async function renderBadge() {
    if (!state.me) return;
    const [{ count }, { data: n }] = await Promise.all([
      db.from('forum_connections').select('id', { count: 'exact', head: true }).eq('addressee_id', state.me.user_id).eq('status', 'pending'),
      db.rpc('forum_connection_count', { p_user: state.me.user_id })
    ]);
    const tab = document.querySelector('[data-fm-tab="people"]');
    if (tab) {
      let b = tab.querySelector('.fm-net-badge');
      if (!b) { b = el('span', { class: 'fm-net-badge', 'aria-label': 'invitations waiting' }); tab.append(b); }
      b.textContent = count ? String(count) : ''; b.hidden = !count;
    }
    const c = $('[data-fm-connections]'); if (c && typeof n === 'number') c.textContent = n;
  }

  // ---------------------------------------------------------------- Me: professional profile editor
  async function renderEditor() {
    const host = $('[data-fm-view="me"]');
    const form = $('[data-fm-me-form]');
    if (!host || !form || !state.me) return;
    host.querySelector('.fm-pro-edit')?.remove();
    const { data: p } = await db.from('forum_profiles').select(PRO_COLS).eq('user_id', state.me.user_id).maybeSingle();
    if (!p) return;
    const msg = status();
    let skills = [...(p.skills || [])];
    const skillList = el('div', { class: 'fm-opp-tags fm-skill-edit' });
    const drawSkills = () => skillList.replaceChildren(...skills.map((s, i) => el('span', {}, [s, el('button', { type: 'button', 'aria-label': `Remove ${s}`, text: '×', onclick: () => { skills.splice(i, 1); drawSkills(); } })])));
    drawSkills();
    const skillIn = el('input', { maxlength: '40', placeholder: 'Type a skill and press Enter (e.g. Grant writing)', 'aria-label': 'Add a skill' });
    skillIn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ',') return;
      e.preventDefault();
      const v = skillIn.value.trim().replace(/,$/, '');
      if (v && skills.length < 20 && !skills.some((s) => s.toLowerCase() === v.toLowerCase())) { skills.push(v); drawSkills(); }
      skillIn.value = '';
    });
    const openTo = el('div', { class: 'fm-chips' }, Object.entries(OPEN_TO).map(([k, t]) => el('label', { class: 'fm-check-chip' }, [
      el('input', { type: 'checkbox', value: k, ...(p.open_to?.includes(k) ? { checked: '' } : {}) }), el('span', { text: t })
    ])));
    const interests = el('div', { class: 'fm-chips' }, Object.entries(INTERESTS).map(([k, t]) => el('label', { class: 'fm-check-chip' }, [
      el('input', { type: 'checkbox', value: k, ...(p.interests?.includes(k) ? { checked: '' } : {}) }), el('span', { text: t })
    ])));
    const repeater = (items, max, make, addText) => {
      const list = el('div', { class: 'fm-rep' });
      const add = (v = {}) => { if (list.children.length < max) list.append(make(v)); };
      items.forEach((v) => add(v));
      return { list, addBtn: el('button', { type: 'button', class: 'fm-text-btn', text: addText, onclick: () => add() }) };
    };
    const expRow = (v) => {
      const r = el('div', { class: 'fm-rep-row' }, [
        el('input', { 'data-k': 'title', maxlength: '100', placeholder: 'Role or title', value: v.title || '', 'aria-label': 'Role or title' }),
        el('input', { 'data-k': 'org', maxlength: '120', placeholder: 'Organisation', value: v.org || '', 'aria-label': 'Organisation' }),
        el('input', { 'data-k': 'start', type: 'month', value: v.start || '', 'aria-label': 'Start (month)' }),
        el('input', { 'data-k': 'end', type: 'month', value: v.end || '', 'aria-label': 'End (month, leave empty if current)' }),
        el('textarea', { 'data-k': 'about', rows: '2', maxlength: '400', placeholder: 'What you did (optional)', 'aria-label': 'Description' }, []),
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Remove', onclick: () => r.remove() })
      ]);
      r.querySelector('textarea').value = v.about || '';
      return r;
    };
    const portRow = (v) => {
      const r = el('div', { class: 'fm-rep-row is-port' }, [
        el('input', { 'data-k': 'title', maxlength: '100', placeholder: 'Title (e.g. Research report, Website, GitHub)', value: v.title || '', 'aria-label': 'Title' }),
        el('input', { 'data-k': 'url', type: 'url', maxlength: '500', placeholder: 'https://…', value: v.url || '', 'aria-label': 'Link' }),
        el('input', { 'data-k': 'about', maxlength: '200', placeholder: 'One line about it (optional)', value: v.about || '', 'aria-label': 'About' }),
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Remove', onclick: () => r.remove() })
      ]);
      return r;
    };
    const exp = repeater(Array.isArray(p.experience) ? p.experience : [], 10, expRow, '+ Add experience');
    const port = repeater(Array.isArray(p.portfolio) ? p.portfolio : [], 8, portRow, '+ Add a link');
    const read = (list) => [...list.children].map((r) => Object.fromEntries([...r.querySelectorAll('[data-k]')].map((n) => [n.dataset.k, n.value.trim()]))).filter((o) => o.title || o.url);
    const save = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Save professional profile', onclick: async () => {
      const experience = read(exp.list).map((o) => ({ title: o.title, org: o.org || '', start: o.start || '', end: o.end || '', about: o.about || '' }));
      const portfolio = read(port.list).map((o) => ({ title: o.title, url: o.url, about: o.about || '' }));
      if (experience.some((o) => o.title.length < 2)) { msg.textContent = 'Each experience needs a role or title.'; return; }
      if (portfolio.some((o) => o.title.length < 2 || !/^https:\/\/\S+$/.test(o.url))) { msg.textContent = 'Each portfolio link needs a title and a link starting with https://'; return; }
      save.disabled = true; msg.textContent = 'Saving…';
      const { error } = await db.from('forum_profiles').update({
        skills, experience, portfolio,
        open_to: [...openTo.querySelectorAll('input:checked')].map((i) => i.value),
        interests: [...interests.querySelectorAll('input:checked')].map((i) => i.value)
      }).eq('user_id', state.me.user_id);
      save.disabled = false;
      msg.textContent = error ? 'Could not save. Check the fields and try again.' : 'Saved. View your profile to see how others see it.';
    } });
    const section = el('section', { class: 'fm-pro-edit' }, [
      el('div', { class: 'fm-admin-bar' }, [el('h2', { text: 'Professional profile' }), el('a', { class: 'fm-text-btn', href: `#profile/${state.me.user_id}`, text: 'View my profile →' })]),
      el('p', { class: 'fm-muted', text: 'Help members and organisations find you. Your bio is the About box above.' }),
      el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'Open to' }), openTo]),
      el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'Skills' }), skillList, skillIn]),
      el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'Experience' }), exp.list, exp.addBtn]),
      el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'Portfolio and links' }), port.list, port.addBtn]),
      el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'Interests' }), interests]),
      el('div', { class: 'fm-actions' }, [save]),
      msg
    ]);
    form.after(section);
  }

  F.hooks.refresh.push(renderBadge);
  F.hooks.view.push((view) => {
    if (view === 'profile') renderProfile(((location.hash || '').split('/')[1]) || state.me?.user_id);
    if (view === 'people') renderNetwork();
    if (view === 'me') renderEditor();
  });
})();
