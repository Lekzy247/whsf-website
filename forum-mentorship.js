// WHSF Forum add-on: Mentorship (#mentorship/<find|mine|mentor>).
// Find a mentor (matched to your skills and interests), request mentoring with your goals, and run the
// mentorship: plan sessions (date, format, link, agenda), keep shared notes, mark sessions done and rate them.
// Mentors set up a profile (areas, languages, formats, how many mentees, availability, booking link).
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar } = F;
  const FORMATS = { video: 'Video call', chat: 'Chat / messages', in_person: 'In person' };
  const MS = { pending: 'Waiting for the mentor', active: 'Active', declined: 'Declined', completed: 'Completed', cancelled: 'Cancelled' };
  const TABS = [['find', 'Find a mentor'], ['mine', 'My mentoring'], ['mentor', 'Become a mentor']];
  const status = () => el('p', { class: 'fm-status', role: 'status' });
  const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const stars = (n) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
  const list = (v) => String(v || '').split(',').map((s) => s.trim().slice(0, 40)).filter(Boolean);

  async function render() {
    const box = $('[data-fm-mentorship]');
    if (!box || !state.me) return;
    const tab = TABS.some(([k]) => k === (location.hash.split('/')[1] || '')) ? location.hash.split('/')[1] : 'find';
    const body = el('div', { class: 'fm-ment-body' }, [el('p', { class: 'fm-muted', text: 'Loading…' })]);
    box.replaceChildren(
      el('div', { class: 'fm-fund-head' }, [el('div', {}, [
        el('h2', { text: 'Mentorship' }),
        el('p', { class: 'fm-muted', text: 'Learn from experienced, ID-verified members. Mentoring on the WHSF Forum is always free.' })
      ])]),
      el('nav', { class: 'fm-admin-tabs', 'aria-label': 'Mentorship' }, TABS.map(([k, t]) => { const a = el('a', { href: `#mentorship/${k}`, class: `fm-admin-tab${k === tab ? ' is-on' : ''}`, text: t }); if (k === tab) a.setAttribute('aria-current', 'page'); return a; })),
      body
    );
    if (tab === 'mine') return mine(body);
    if (tab === 'mentor') return mentorForm(body);
    return find(body);
  }

  // ---------------------------------------------------------------- find a mentor
  async function find(body, q = '') {
    const search = el('input', { type: 'search', placeholder: 'Search by name or area (e.g. grant writing, careers, AI)', 'aria-label': 'Search mentors', maxlength: '60', value: q });
    const grid = el('div', { class: 'fm-ment-grid' }, [el('p', { class: 'fm-muted', text: 'Finding mentors…' })]);
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load(search.value.trim()), 350); });
    body.replaceChildren(search, grid);
    const { data: open } = await db.from('forum_mentorships').select('mentor_id,status').eq('mentee_id', state.me.user_id).in('status', ['pending', 'active']);
    const mineSet = new Map((open || []).map((r) => [r.mentor_id, r.status]));
    async function load(term) {
      const { data, error } = await db.rpc('forum_mentor_matches', { p_limit: 40, p_q: term || null });
      if (error) { grid.replaceChildren(el('p', { class: 'fm-muted', text: 'Mentors could not be loaded.' })); return; }
      grid.replaceChildren(...(data?.length ? data.map((m) => mentorCard(m, mineSet.get(m.user_id))) : [
        el('div', { class: 'fm-empty' }, [term ? 'No mentors match that search.' : 'No mentors yet. Be the first: ', term ? null : el('a', { href: '#mentorship/mentor', text: 'Become a mentor →' })])
      ]));
    }
    load(q);
  }

  function mentorCard(m, relation) {
    const av = el('div', { class: 'fm-avatar fm-avatar-lg', 'aria-hidden': 'true' }); fillAvatar(av, m);
    const slot = el('div');
    const msg = status();
    const full = m.spots_left <= 0;
    const action = relation === 'active' ? el('a', { class: 'hp-btn hp-btn-outline', href: '#mentorship/mine', text: '✓ Your mentor' })
      : relation === 'pending' ? el('span', { class: 'fm-small fm-muted', text: 'Request sent · waiting' })
        : full ? el('span', { class: 'fm-small fm-muted', text: 'Fully booked right now' })
          : el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Request mentorship', onclick: () => {
            if (slot.firstChild) return;
            const goals = el('textarea', { rows: '4', maxlength: '1000', placeholder: `What do you want to achieve with ${m.display_name}? (e.g. write my first grant proposal, prepare for interviews)`, 'aria-label': 'Your goals' });
            slot.append(el('div', { class: 'fm-collab-invite' }, [goals,
              el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Send request', onclick: async () => {
                const { error } = await db.rpc('forum_mentor_request', { p_mentor: m.user_id, p_goals: goals.value });
                if (error) { msg.textContent = error.message; return; }
                slot.replaceChildren(el('p', { class: 'fm-small', text: `Request sent. ${m.display_name} will get an alert.` }));
              } })]));
            goals.focus();
          } });
    return el('article', { class: 'fm-ment-card' }, [
      el('a', { class: 'fm-net-who', href: `#profile/${m.user_id}` }, [av, el('span', {}, [el('strong', { text: m.display_name }), el('small', { text: m.headline || m.location || 'WHSF mentor' })])]),
      el('p', { class: 'fm-ment-pitch', text: m.pitch }),
      el('div', { class: 'fm-opp-tags fm-skill-tags' }, (m.areas || []).map((a) => el('span', { text: a }))),
      el('p', { class: 'fm-small fm-muted', text: [
        (m.formats || []).map((f) => FORMATS[f]).join(', '),
        (m.languages || []).join(', '),
        m.availability
      ].filter(Boolean).join(' · ') }),
      el('p', { class: 'fm-ment-stats' }, [
        m.rating ? el('span', { class: 'fm-stars', title: `${m.rating} out of 5`, text: `${stars(m.rating)} ${m.rating}` }) : null,
        el('span', { text: `${m.sessions_done} session${Number(m.sessions_done) === 1 ? '' : 's'} given` }),
        el('span', { text: full ? 'No spots left' : `${m.spots_left} spot${m.spots_left === 1 ? '' : 's'} left` }),
        m.score > 0 ? el('span', { class: 'fm-match', text: 'Good match for you' }) : null
      ]),
      action, slot, msg
    ]);
  }

  // ---------------------------------------------------------------- my mentoring (as mentee and as mentor)
  async function mine(body) {
    const me = state.me.user_id;
    const { data: rows } = await db.from('forum_mentorships').select('id,mentor_id,mentee_id,goals,status,mentor_note,created_at,responded_at,ended_at')
      .or(`mentor_id.eq.${me},mentee_id.eq.${me}`).order('created_at', { ascending: false }).limit(100);
    const ms = rows || [];
    const others = [...new Set(ms.map((r) => (r.mentor_id === me ? r.mentee_id : r.mentor_id)))];
    const [{ data: profs }, { data: mentorRows }, { data: sessions }] = await Promise.all([
      others.length ? db.from('forum_profiles').select('user_id,display_name,headline,avatar_url').in('user_id', others) : { data: [] },
      others.length ? db.from('forum_mentors').select('user_id,booking_url').in('user_id', others) : { data: [] },
      ms.length ? db.from('forum_mentor_sessions').select('*').in('mentorship_id', ms.map((r) => r.id)).order('scheduled_at') : { data: [] }
    ]);
    const pm = new Map((profs || []).map((p) => [p.user_id, p]));
    const bm = new Map((mentorRows || []).map((p) => [p.user_id, p.booking_url]));
    const sessionsOf = (id) => (sessions || []).filter((s) => s.mentorship_id === id);
    const incoming = ms.filter((r) => r.mentor_id === me && r.status === 'pending');
    const active = ms.filter((r) => r.status === 'active');
    const past = ms.filter((r) => !['pending', 'active'].includes(r.status) || (r.status === 'pending' && r.mentee_id === me));
    const head = (r) => {
      const other = pm.get(r.mentor_id === me ? r.mentee_id : r.mentor_id) || { display_name: 'Member' };
      const av = el('div', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' }); fillAvatar(av, other);
      return el('div', { class: 'fm-admin-card-head' }, [
        el('a', { class: 'fm-net-who', href: `#profile/${r.mentor_id === me ? r.mentee_id : r.mentor_id}` }, [av, el('span', {}, [el('strong', { text: other.display_name }), el('small', { text: r.mentor_id === me ? 'Your mentee' : 'Your mentor' })])]),
        el('span', { class: `fm-app-status is-${r.status === 'active' ? 'shortlisted' : r.status === 'pending' ? 'reviewing' : 'withdrawn'}`, text: r.status === 'pending' && r.mentor_id === me ? 'New request' : MS[r.status] })
      ]);
    };
    body.replaceChildren(...[
      incoming.length ? el('h3', { class: 'fm-admin-h', text: `Requests for you (${incoming.length})` }) : null,
      ...incoming.map((r) => {
        const msg = status();
        const note = el('input', { maxlength: '500', placeholder: 'A short note back (optional)', 'aria-label': 'Note' });
        const respond = async (accept) => { const { error } = await db.rpc('forum_mentor_respond', { p_id: r.id, p_accept: accept, p_note: note.value }); if (error) msg.textContent = error.message; else mine(body); };
        return el('article', { class: 'fm-admin-card' }, [head(r), el('blockquote', { class: 'fm-admin-quote', text: r.goals }), el('div', { class: 'fm-admin-row' }, [note,
          el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Accept', onclick: () => respond(true) }),
          el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Decline', onclick: () => respond(false) })]), msg]);
      }),
      el('h3', { class: 'fm-admin-h', text: `Active mentorships (${active.length})` }),
      active.length ? el('div', { class: 'fm-admin-list' }, active.map((r) => activeCard(r, head(r), sessionsOf(r.id), bm.get(r.mentor_id), body)))
        : el('p', { class: 'fm-empty' }, ['No active mentorships. ', el('a', { href: '#mentorship/find', text: 'Find a mentor →' })]),
      past.length ? el('h3', { class: 'fm-admin-h', text: 'Requests and past mentorships' }) : null,
      ...past.map((r) => {
        const msg = status();
        return el('article', { class: 'fm-admin-card fm-ment-past' }, [head(r), el('p', { class: 'fm-small', text: r.goals }),
          r.mentor_note ? el('p', { class: 'fm-small fm-muted', text: `Mentor's note: ${r.mentor_note}` }) : null,
          r.status === 'pending' ? el('button', { type: 'button', class: 'fm-text-btn', text: 'Cancel request', onclick: async () => { const { error } = await db.rpc('forum_mentorship_end', { p_id: r.id }); if (error) msg.textContent = error.message; else mine(body); } }) : null,
          msg].filter(Boolean));
      })
    ].filter(Boolean));
  }

  function activeCard(r, head, sessions, bookingUrl, body) {
    const me = state.me.user_id;
    const isMentee = r.mentee_id === me;
    const msg = status();
    const upcoming = sessions.filter((s) => s.status === 'scheduled');
    const done = sessions.filter((s) => s.status === 'completed');
    const plan = el('div');
    const sessionRow = (s) => {
      const notes = el('textarea', { rows: '2', maxlength: '2000', placeholder: 'Shared notes: what you covered, next steps', 'aria-label': 'Session notes' }); notes.value = s.notes || '';
      const row = el('li', { class: `fm-ment-session is-${s.status}` }, [
        el('div', { class: 'fm-admin-card-head' }, [el('strong', { text: when(s.scheduled_at) }), el('small', { class: 'fm-muted', text: `${s.duration_min} min · ${FORMATS[s.format]}` })]),
        s.agenda ? el('p', { class: 'fm-small', text: `Agenda: ${s.agenda}` }) : null,
        s.link && s.status === 'scheduled' ? el('a', { class: 'hp-btn hp-btn-primary', href: s.link, target: '_blank', rel: 'noopener noreferrer', text: 'Join session ↗' }) : null,
        notes,
        el('div', { class: 'fm-actions' }, s.status === 'scheduled' ? [
          el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: '✓ Mark as done', onclick: async () => { const { error } = await db.rpc('forum_session_update', { p_id: s.id, p_status: 'completed', p_notes: notes.value }); if (error) msg.textContent = error.message; else mine(body); } }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Save notes', onclick: async () => { const { error } = await db.rpc('forum_session_update', { p_id: s.id, p_status: 'scheduled', p_notes: notes.value }); msg.textContent = error ? error.message : 'Notes saved.'; } }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Cancel session', onclick: async () => { const { error } = await db.rpc('forum_session_update', { p_id: s.id, p_status: 'cancelled' }); if (error) msg.textContent = error.message; else mine(body); } })
        ] : [el('button', { type: 'button', class: 'fm-text-btn', text: 'Save notes', onclick: async () => { const { error } = await db.rpc('forum_session_update', { p_id: s.id, p_status: s.status, p_notes: notes.value }); msg.textContent = error ? error.message : 'Notes saved.'; } })])
      ].filter(Boolean));
      if (s.status === 'completed' && isMentee) {
        if (s.rating) row.append(el('p', { class: 'fm-small', text: `Your rating: ${stars(s.rating)}${s.feedback ? ` · “${s.feedback}”` : ''}` }));
        else {
          let pick = 0;
          const starsRow = el('div', { class: 'fm-star-pick', role: 'radiogroup', 'aria-label': 'Rate this session' }, [1, 2, 3, 4, 5].map((n) => el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': `${n} star${n === 1 ? '' : 's'}`, text: '☆', onclick: () => {
            pick = n; starsRow.querySelectorAll('button').forEach((b, i) => { b.textContent = i < n ? '★' : '☆'; b.setAttribute('aria-checked', String(i + 1 === n)); });
          } })));
          const fb = el('input', { maxlength: '1000', placeholder: 'What helped most? (optional)', 'aria-label': 'Feedback' });
          row.append(el('div', { class: 'fm-ment-rate' }, [el('small', { text: 'How was this session?' }), starsRow, fb,
            el('button', { type: 'button', class: 'fm-text-btn', text: 'Send rating', onclick: async () => {
              if (!pick) { msg.textContent = 'Choose 1 to 5 stars.'; return; }
              const { error } = await db.rpc('forum_session_feedback', { p_id: s.id, p_rating: pick, p_feedback: fb.value });
              if (error) msg.textContent = error.message; else mine(body);
            } })]));
        }
      }
      return row;
    };
    const planForm = () => {
      if (plan.firstChild) return;
      const at = el('input', { type: 'datetime-local', 'aria-label': 'Date and time', min: new Date(Date.now() + 3600000).toISOString().slice(0, 16) });
      const dur = el('select', { 'aria-label': 'Length' }, [[30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1.5 hours']].map(([v, t]) => el('option', { value: String(v), text: t }))); dur.value = '45';
      const fmt = el('select', { 'aria-label': 'Format' }, Object.entries(FORMATS).map(([v, t]) => el('option', { value: v, text: t })));
      const link = el('input', { type: 'url', maxlength: '300', placeholder: 'Meeting link (Teams, Zoom, Meet) https://…', 'aria-label': 'Meeting link' });
      const agenda = el('input', { maxlength: '500', placeholder: 'Agenda (optional)', 'aria-label': 'Agenda' });
      plan.append(el('div', { class: 'fm-ment-plan' }, [at, dur, fmt, link, agenda,
        el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Plan session', onclick: async () => {
          if (!at.value) { msg.textContent = 'Choose the date and time.'; return; }
          if (link.value && !/^https:\/\/\S+$/.test(link.value.trim())) { msg.textContent = 'The meeting link must start with https://'; return; }
          const { error } = await db.rpc('forum_session_schedule', { p_mentorship: r.id, p_at: new Date(at.value).toISOString(), p_minutes: Number(dur.value), p_format: fmt.value, p_link: link.value.trim() || null, p_agenda: agenda.value });
          if (error) msg.textContent = error.message; else mine(body);
        } })]));
    };
    return el('article', { class: 'fm-admin-card fm-ment-active' }, [
      head,
      el('details', { class: 'fm-ment-goals' }, [el('summary', { text: 'Goals' }), el('p', { class: 'fm-small', text: r.goals }), r.mentor_note ? el('p', { class: 'fm-small fm-muted', text: `Mentor's note: ${r.mentor_note}` }) : null]),
      el('div', { class: 'fm-actions' }, [
        el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: '+ Plan a session', onclick: planForm }),
        isMentee && bookingUrl ? el('a', { class: 'hp-btn hp-btn-outline', href: bookingUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Book on the mentor’s calendar ↗' }) : null,
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Message', onclick: () => F.startMessage?.(isMentee ? r.mentor_id : r.mentee_id) })
      ]),
      plan,
      upcoming.length ? el('h4', { class: 'fm-ment-h', text: 'Upcoming sessions' }) : null,
      upcoming.length ? el('ol', { class: 'fm-ment-sessions' }, upcoming.map(sessionRow)) : null,
      done.length ? el('h4', { class: 'fm-ment-h', text: `Completed sessions (${done.length})` }) : null,
      done.length ? el('ol', { class: 'fm-ment-sessions' }, done.map(sessionRow)) : null,
      el('button', { type: 'button', class: 'fm-text-btn fm-ment-end', text: 'End mentorship', onclick: (e) => {
        const b = e.currentTarget;
        if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Click again to end this mentorship'; return; }
        db.rpc('forum_mentorship_end', { p_id: r.id }).then(({ error }) => { if (error) msg.textContent = error.message; else mine(body); });
      } }),
      msg
    ].filter(Boolean));
  }

  // ---------------------------------------------------------------- become a mentor
  async function mentorForm(body) {
    const { data: m } = await db.from('forum_mentors').select('*').eq('user_id', state.me.user_id).maybeSingle();
    const msg = status();
    const field = (label, input, hint) => el('label', {}, [label, hint ? el('small', { text: ` ${hint}` }) : null, input]);
    const pitch = el('textarea', { rows: '4', maxlength: '600', placeholder: 'Who you help and how (e.g. I help early-career NGO staff write their first grant proposals).' }); pitch.value = m?.pitch || '';
    const areas = el('input', { maxlength: '400', placeholder: 'e.g. Grant writing, Careers, Data analysis, AI', value: (m?.areas || []).join(', ') });
    const langs = el('input', { maxlength: '200', placeholder: 'e.g. English, French', value: (m?.languages || ['English']).join(', ') });
    const formats = el('div', { class: 'fm-chips' }, Object.entries(FORMATS).map(([k, t]) => el('label', { class: 'fm-check-chip' }, [el('input', { type: 'checkbox', value: k, ...((m?.formats || ['video']).includes(k) ? { checked: '' } : {}) }), el('span', { text: t })])));
    const capacity = el('input', { type: 'number', min: '1', max: '20', value: String(m?.capacity || 3) });
    const availability = el('input', { maxlength: '200', placeholder: 'e.g. Weekday evenings (GMT), 2 hours a month', value: m?.availability || '' });
    const booking = el('input', { type: 'url', maxlength: '300', placeholder: 'https://… (Microsoft Bookings, Calendly or similar)', value: m?.booking_url || '' });
    const active = el('input', { type: 'checkbox', ...((m ? m.is_active : true) ? { checked: '' } : {}) });
    const save = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: m ? 'Save mentor profile' : 'Become a mentor', onclick: async () => {
      const row = {
        user_id: state.me.user_id, pitch: pitch.value.trim(), areas: list(areas.value).slice(0, 10), languages: list(langs.value).slice(0, 8),
        formats: [...formats.querySelectorAll('input:checked')].map((i) => i.value), capacity: Math.min(20, Math.max(1, Number(capacity.value) || 3)),
        availability: availability.value.trim() || null, booking_url: booking.value.trim() || null, is_active: active.checked, updated_at: new Date().toISOString()
      };
      if (row.pitch.length < 20) { msg.textContent = 'Write at least a sentence about who you help.'; return; }
      if (!row.areas.length) { msg.textContent = 'Add at least one area you mentor in.'; return; }
      if (!row.languages.length) { msg.textContent = 'Add at least one language.'; return; }
      if (!row.formats.length) { msg.textContent = 'Choose at least one format.'; return; }
      if (row.booking_url && !/^https:\/\/\S+$/.test(row.booking_url)) { msg.textContent = 'The booking link must start with https://'; return; }
      save.disabled = true;
      const { error } = m ? await db.from('forum_mentors').update(row).eq('user_id', state.me.user_id) : await db.from('forum_mentors').insert(row);
      save.disabled = false;
      msg.textContent = error ? 'Could not save. Check the fields and try again.' : 'Saved. Members can now find you under Find a mentor.';
      if (!error && !m) mentorForm(body);
    } });
    body.replaceChildren(el('div', { class: 'fm-form fm-org-form' }, [
      el('h3', { text: m ? 'Your mentor profile' : 'Become a WHSF mentor' }),
      el('p', { class: 'fm-small fm-muted', text: 'Share your experience with members who are starting out. You choose how many mentees you take and when you meet. Mentoring is always free.' }),
      field('About your mentoring', pitch),
      el('div', { class: 'fm-two' }, [field('Areas (comma separated)', areas), field('Languages', langs)]),
      el('div', { class: 'fm-pro-block' }, [el('strong', { text: 'How you meet' }), formats]),
      el('div', { class: 'fm-two' }, [field('Mentees at a time', capacity), field('Availability', availability, '(optional)')]),
      field('Booking link', booking, '(optional: mentees can book a slot directly)'),
      el('label', { class: 'fm-check' }, [active, el('span', { text: 'Show me in Find a mentor (untick to pause)' })]),
      el('div', { class: 'fm-actions' }, [save]),
      msg
    ]));
  }

  F.hooks.view.push((view) => { if (view === 'mentorship') render(); });
})();
