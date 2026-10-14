// "Take part" panel for WHSF programme pages: Register, Join the community (Forum space), Find a mentor and
// Upcoming training. Mount with <section id="take-part" data-take-part="mil_lab"></section>, or
// data-take-part="all" for a programme chooser (Programmes page; #take-part:girls_in_ict preselects one).
(() => {
  const root = document.querySelector('[data-take-part]');
  if (!root) return;
  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const P = {
    digital_skills: { name: 'Digital Skills', space: 'digital_ai', who: 'Adults learning digital foundations, productivity and online safety.', adultsOnly: false },
    girls_in_ict: { name: 'Girls in ICT', space: 'women_tech', who: 'Girls in school. A parent, guardian, teacher or school registers them.', minors: true },
    robotics_drones: { name: 'Robotics & Drones', space: 'digital_ai', who: 'Hands-on STEM for learners, schools and youth groups.', adultsOnly: false },
    mil_lab: { name: 'MIL Lab', space: 'media_literacy', who: 'Young people aged 18 to 30, plus schools, youth groups and partners.', adultsOnly: true }
  };
  const ROLES = [
    ['participant', 'I want to take part myself (18 or over)'],
    ['parent_guardian', 'I am a parent or guardian'],
    ['teacher_school', 'I am a teacher or registering a school / group'],
    ['partner_org', 'I represent a partner organisation'],
    ['volunteer_mentor', 'I want to volunteer or mentor']
  ];
  const el = (tag, props = {}, kids = []) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    });
    kids.forEach((c) => c !== null && c !== undefined && n.append(c));
    return n;
  };
  const forum = (hash) => `forum.html${hash}`;

  const fixed = root.dataset.takePart !== 'all' ? root.dataset.takePart : null;
  const fromHash = (location.hash.match(/^#take-part:([a-z_]+)$/) || [])[1];
  let current = fixed || (P[fromHash] ? fromHash : 'digital_skills');

  async function trainings(space) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/whsf_public_programme_events`, {
        method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_space: space })
      });
      return res.ok ? await res.json() : [];
    } catch { return []; }
  }

  function registerForm(key) {
    const prog = P[key];
    const status = el('p', { class: 'tp-status', role: 'status', 'aria-live': 'polite' });
    const roles = ROLES.filter(([r]) => !(prog.minors && r === 'participant'));
    const role = el('select', { name: 'role', required: true }, [el('option', { value: '', text: 'Choose one' }), ...roles.map(([v, t]) => el('option', { value: v, text: t }))]);
    const adultRow = el('label', { class: 'tp-check', hidden: true }, [el('input', { type: 'checkbox', name: 'adult' }), el('span', { text: 'I confirm I am 18 or over.' })]);
    role.addEventListener('change', () => { adultRow.hidden = role.value !== 'participant'; });
    const startedAt = Date.now();
    const form = el('form', { class: 'tp-form', novalidate: true }, [
      prog.minors ? el('p', { class: 'tp-note', text: 'Girls in ICT learners are children, so a parent, guardian, teacher or school registers them. Please do not include any child\'s personal details: our team will follow up with you.' }) : null,
      el('label', {}, ['Registering as', role]),
      adultRow,
      el('div', { class: 'tp-row' }, [
        el('label', {}, ['Full name', el('input', { name: 'fullName', autocomplete: 'name', maxlength: '120', required: true })]),
        el('label', {}, ['Email', el('input', { name: 'email', type: 'email', autocomplete: 'email', maxlength: '254', required: true })])
      ]),
      el('div', { class: 'tp-row' }, [
        el('label', {}, ['Country', el('input', { name: 'country', autocomplete: 'country-name', maxlength: '80', required: true })]),
        el('label', {}, ['Organisation or school (optional)', el('input', { name: 'organisation', autocomplete: 'organization', maxlength: '160' })])
      ]),
      el('label', {}, ['Anything we should know? (optional)', el('textarea', { name: 'message', rows: '3', maxlength: '1000' })]),
      el('label', { class: 'tp-hp', 'aria-hidden': 'true' }, ['Website', el('input', { name: 'website', tabindex: '-1', autocomplete: 'off' })]),
      el('label', { class: 'tp-check' }, [el('input', { type: 'checkbox', name: 'consent' }), el('span', { text: `I agree that WHSF may store these details and contact me about ${prog.name}. WHSF programmes are free and WHSF never asks for payment.` })]),
      el('button', { class: 'tp-btn tp-btn-primary', type: 'submit', text: `Register for ${prog.name}` }),
      status
    ]);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = form.elements;
      const say = (t) => { status.textContent = t; status.classList.toggle('is-error', true); };
      if (!f.role.value) return say('Choose how you are registering.');
      if (f.role.value === 'participant' && !f.adult.checked) return say('Please confirm you are 18 or over. Younger learners are registered by a parent, guardian or teacher.');
      if (f.fullName.value.trim().length < 2) return say('Enter your full name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return say('Enter a valid email address.');
      if (f.country.value.trim().length < 2) return say('Enter your country.');
      if (!f.consent.checked) return say('Please tick the box to agree to be contacted.');
      const btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      status.classList.remove('is-error'); status.textContent = 'Sending…';
      try {
        const res = await fetch('/api/programme-register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programme: key, role: f.role.value, fullName: f.fullName.value, email: f.email.value, country: f.country.value,
            organisation: f.organisation.value, message: f.message.value, adultConfirmed: f.role.value === 'participant' && f.adult.checked,
            consent: true, website: f.website.value, startedAt
          })
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) { btn.disabled = false; return say(out.error || 'Your registration could not be sent. Please try again.'); }
        form.replaceWith(el('div', { class: 'tp-done', role: 'status' }, [
          el('strong', { text: '✓ You\'re registered' }),
          el('p', { text: out.message || 'Thank you. Check your email for a confirmation.' }),
          el('a', { class: 'tp-btn tp-btn-outline', href: forum(`#space/${prog.space}`), text: 'Meanwhile, join the community →' })
        ]));
      } catch {
        btn.disabled = false; say('Your registration could not be sent. Check your connection and try again.');
      }
    });
    return form;
  }

  async function render() {
    const prog = P[current];
    const formSlot = el('div', { class: 'tp-form-slot', hidden: true });
    const list = el('ul', { class: 'tp-trainings' }, [el('li', { class: 'tp-muted', text: 'Loading…' })]);
    const card = (num, title, text, action) => el('article', { class: 'tp-card' }, [
      el('span', { class: 'tp-num', 'aria-hidden': 'true', text: num }),
      el('h3', { text: title }), el('p', { text }), action
    ]);
    root.replaceChildren(el('div', { class: 'tp-shell' }, [
      el('div', { class: 'tp-head' }, [
        el('span', { class: 'tp-eyebrow', text: 'Take part' }),
        el('h2', { id: 'take-part-title', text: fixed ? `Join ${prog.name}` : 'Take part in a WHSF programme' }),
        el('p', { text: 'Register, meet the community, find a mentor and see the next trainings: all free.' })
      ]),
      fixed ? null : el('div', { class: 'tp-tabs', role: 'tablist', 'aria-label': 'Choose a programme' }, Object.entries(P).map(([k, v]) => el('button', {
        type: 'button', role: 'tab', class: `tp-tab${k === current ? ' is-on' : ''}`, 'aria-selected': String(k === current), text: v.name,
        onclick: () => { current = k; render(); }
      }))),
      el('p', { class: 'tp-who', text: prog.who }),
      el('div', { class: 'tp-grid' }, [
        card('1', 'Register', prog.minors ? 'Parents, guardians, teachers and schools register learners for the next intake.' : 'Tell us you want to join the next intake. We confirm by email.',
          el('button', { type: 'button', class: 'tp-btn tp-btn-primary', text: 'Register now', onclick: () => {
            formSlot.hidden = !formSlot.hidden;
            if (!formSlot.hidden && !formSlot.firstChild) formSlot.append(registerForm(current));
            if (!formSlot.hidden) formSlot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } })),
        card('2', 'Join the community', `Talk with ${prog.name} participants, alumni and experts in the WHSF Forum space. Free, for adults 18+.`,
          el('a', { class: 'tp-btn tp-btn-outline', href: forum(`#space/${prog.space}`), text: 'Open the community' })),
        card('3', 'Find a mentor', 'Meet verified mentors in the Forum\'s Mentorship space, or offer to mentor others.',
          el('a', { class: 'tp-btn tp-btn-outline', href: forum('#space/mentorship'), text: 'Find a mentor' })),
        card('4', 'Upcoming training', 'Sessions, workshops and webinars for this programme.', list)
      ]),
      formSlot
    ]));
    const rows = await trainings(prog.space);
    list.replaceChildren(...(rows.length
      ? rows.map((e) => el('li', {}, [
        el('a', { href: forum(`#events/${e.id}`), text: e.title }),
        el('small', { text: `${new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${e.format === 'online' ? 'Online' : [e.city, e.country].filter(Boolean).join(', ') || 'In person'}` })
      ]))
      : [el('li', { class: 'tp-muted', text: 'No sessions scheduled yet. Register and we\'ll tell you first.' })]));
  }
  render();
  if (fromHash) setTimeout(() => root.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  if (!fixed) window.addEventListener('hashchange', () => {
    const k = (location.hash.match(/^#take-part:([a-z_]+)$/) || [])[1];
    if (!P[k]) return;
    if (k !== current) { current = k; render(); }
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
