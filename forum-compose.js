// WHSF Forum add-on: richer posts. Poll, Document (PDF), Video, Event announcement and Collaboration request.
// Files go to the private forum-files bucket (members only, signed links that expire). Each file is checked
// here (type, size, real file signature) and again by the database before the post is accepted.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  const form = $('[data-fm-post-form]');
  if (!form) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = (paths) => {
    const s = document.createElementNS(svgNS, 'svg');
    Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }).forEach(([k, v]) => s.setAttribute(k, v));
    paths.forEach((d) => { const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', d); s.append(p); });
    return s;
  };
  const MB = 1024 * 1024;
  const LIMITS = { document: 10 * MB, video: 50 * MB };
  const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  const NEEDS = {
    partner_org: 'Partner organisation', volunteers: 'Volunteers', researcher: 'Researcher / co-author', mentor: 'Mentor',
    funding_partner: 'Funding partner', speaker: 'Speaker / trainer', cofounder: 'Co-founder / team member', other: 'Other support'
  };
  const sizeText = (n) => (n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  // ---------------------------------------------------------------- composer tools
  const TOOLS = [
    ['poll', 'Poll', ['M3 3v18h18', 'M7 16v-3', 'M12 16V8', 'M17 16v-6']],
    ['document', 'Document', ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 13h6', 'M9 17h6']],
    ['video', 'Video', ['M23 7l-7 5 7 5z', 'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z']],
    ['event', 'Event', ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']],
    ['collab', 'Collaborate', ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6', 'M22 11h-6']]
  ];
  let mode = null; let file = null;
  const panel = el('div', { class: 'fm-compose-panel', hidden: '' });
  form.querySelector('[data-fm-location-row]').after(panel);
  const toolRow = form.querySelector('.fm-tools');
  const topicPick = toolRow.querySelector('.fm-topic-pick');
  const toolBtns = TOOLS.map(([key, label, paths]) => {
    const b = el('button', { type: 'button', class: 'fm-tool', 'aria-pressed': 'false', title: label, onclick: () => setMode(mode === key ? null : key) }, [icon(paths), label]);
    b.dataset.mode = key;
    toolRow.insertBefore(b, topicPick);
    return b;
  });
  // The old "Opportunities" link now opens the Forum's own funding finder.
  const oppLink = toolRow.querySelector('a.fm-tool[href="grants.html"]');
  if (oppLink) oppLink.setAttribute('href', '#funding');

  function setMode(next) {
    mode = next; file = null;
    toolBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    panel.hidden = !mode;
    panel.replaceChildren();
    const ta = form.body;
    ta.placeholder = mode === 'poll' ? 'Ask a question…' : mode === 'collab' ? 'Describe the project and the help you need…' : mode === 'event' ? 'Why should people join this event?' : 'Start a conversation';
    if (!mode) return;
    const head = (title, hint) => el('div', { class: 'fm-compose-head' }, [
      el('strong', { text: title }),
      hint ? el('small', { class: 'fm-muted', text: hint }) : null,
      el('button', { type: 'button', class: 'fm-text-btn', text: 'Remove', onclick: () => setMode(null) })
    ]);
    if (mode === 'poll') {
      const list = el('div', { class: 'fm-poll-inputs' });
      const addOpt = (v = '') => {
        if (list.children.length >= 6) return;
        list.append(el('input', { name: 'poll_option', maxlength: '100', placeholder: `Choice ${list.children.length + 1}`, 'aria-label': `Choice ${list.children.length + 1}`, value: v }));
        addBtn.hidden = list.children.length >= 6;
      };
      const addBtn = el('button', { type: 'button', class: 'fm-text-btn', text: '+ Add a choice', onclick: () => addOpt() });
      const dur = el('select', { name: 'poll_days', 'aria-label': 'Poll length' }, [['1', '1 day'], ['3', '3 days'], ['7', '1 week'], ['14', '2 weeks'], ['30', '30 days']].map(([v, t]) => el('option', { value: v, text: t })));
      dur.value = '7';
      panel.append(head('Poll', 'Your post text is the question. 2 to 6 choices, one vote per member.'), list, addBtn, el('label', { class: 'fm-inline-label' }, ['Poll length ', dur]));
      addOpt(); addOpt();
    } else if (mode === 'document' || mode === 'video') {
      const isDoc = mode === 'document';
      const input = el('input', { type: 'file', accept: isDoc ? 'application/pdf,.pdf' : 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov', hidden: '' });
      const chosen = el('div', { class: 'fm-file-chosen' });
      const status = el('small', { class: 'fm-muted', text: isDoc ? 'PDF only, up to 10 MB. Visible to verified members only.' : 'MP4, WebM or MOV, up to 50 MB. Visible to verified members only.' });
      input.addEventListener('change', async () => {
        const f = input.files[0]; input.value = '';
        if (!f) return;
        const problem = await checkFile(f, mode);
        if (problem) { status.textContent = problem; file = null; chosen.replaceChildren(); return; }
        file = f;
        status.textContent = 'Ready to post.';
        chosen.replaceChildren(
          isDoc ? el('span', { class: 'fm-file-badge', text: 'PDF' }) : el('video', { class: 'fm-video-preview', src: URL.createObjectURL(f), muted: '', playsinline: '', preload: 'metadata' }),
          el('span', {}, [el('strong', { text: f.name }), el('small', { text: sizeText(f.size) })])
        );
      });
      panel.append(head(isDoc ? 'Document' : 'Video'), el('label', { class: 'hp-btn hp-btn-outline fm-file-pick' }, [isDoc ? 'Choose a PDF' : 'Choose a video', input]), chosen, status);
    } else if (mode === 'event') {
      const pick = el('select', { name: 'event_id', 'aria-label': 'Event to announce' }, [el('option', { value: '', text: 'Loading events…' })]);
      panel.append(head('Event announcement', 'Share an upcoming event. Members can open it and register.'), pick);
      db.from('forum_events').select('id,title,starts_at,time_zone,status').eq('status', 'published').gte('ends_at', new Date().toISOString()).order('starts_at').limit(60)
        .then(({ data }) => {
          pick.replaceChildren(el('option', { value: '', text: data?.length ? 'Choose an event' : 'No upcoming events yet' }),
            ...(data || []).map((e) => el('option', { value: e.id, text: `${new Date(e.starts_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${e.title}` })));
          if (!data?.length) panel.append(el('a', { class: 'fm-text-btn', href: '#events/new', text: 'Host an event →' }));
        });
    } else if (mode === 'collab') {
      const need = el('select', { name: 'collab_need', 'aria-label': 'Looking for' }, Object.entries(NEEDS).map(([v, t]) => el('option', { value: v, text: t })));
      const skills = el('input', { name: 'collab_skills', maxlength: '300', placeholder: 'e.g. M&E, fundraising, Python, French' });
      const where = el('input', { name: 'collab_where', maxlength: '80', placeholder: 'Remote, or a city / country' });
      const until = el('input', { name: 'collab_deadline', type: 'date', min: new Date().toISOString().slice(0, 10) });
      panel.append(head('Collaboration request', 'Members can reply with "I\'m interested" to message you.'),
        el('div', { class: 'fm-collab-fields' }, [
          el('label', {}, ['Looking for', need]),
          el('label', {}, ['Skills or expertise (comma separated)', skills]),
          el('label', {}, ['Where', where]),
          el('label', {}, ['Respond by (optional)', until])
        ]));
    }
  }

  // Real file checks: size, declared type and the file's own signature bytes.
  async function checkFile(f, kind) {
    if (f.size > LIMITS[kind]) return kind === 'document' ? 'This PDF is larger than 10 MB.' : 'This video is larger than 50 MB.';
    const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
    const ascii = (a, b) => String.fromCharCode(...head.slice(a, b));
    if (kind === 'document') {
      if (!/\.pdf$/i.test(f.name) || ascii(0, 5) !== '%PDF-') return 'Only real PDF files can be shared.';
      return null;
    }
    if (!VIDEO_TYPES[f.type]) return 'Use an MP4, WebM or MOV video.';
    const isMp4 = ascii(4, 8) === 'ftyp';
    const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    if (!(isMp4 || isWebm)) return 'This file does not look like a real video.';
    return null;
  }

  // Called by forum.js when Post is pressed.
  F.composeExtra = async ({ body, topic, location }) => {
    if (!mode) return null;
    if (['poll', 'document', 'video'].includes(mode) && state.file) return { error: 'A post can have one picture, document, video or poll. Remove the picture first.' };
    if (mode === 'poll') {
      const options = [...panel.querySelectorAll('input[name="poll_option"]')].map((i) => i.value.trim()).filter(Boolean);
      if (options.length < 2) return { error: 'Add at least two choices.' };
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { error: 'Each choice must be different.' };
      const days = Number(panel.querySelector('select[name="poll_days"]').value || 7);
      const { error } = await db.rpc('forum_create_poll', { p_body: body, p_topic: topic, p_options: options, p_closes_at: new Date(Date.now() + days * 86400000).toISOString(), p_location: location });
      return error ? { error: error.message } : { done: true };
    }
    if (mode === 'document' || mode === 'video') {
      if (!file) return { error: mode === 'document' ? 'Choose a PDF first.' : 'Choose a video first.' };
      const ext = mode === 'document' ? 'pdf' : VIDEO_TYPES[file.type];
      const path = `${state.me.user_id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from('forum-files').upload(path, file, { contentType: mode === 'document' ? 'application/pdf' : file.type, upsert: false });
      if (error) return { error: 'The file could not be uploaded. Please try again.' };
      const name = file.name.replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 120) || (mode === 'document' ? 'document.pdf' : 'video');
      return {
        fields: { attachment_path: path, attachment_name: name, attachment_kind: mode, attachment_size: file.size },
        cleanup: () => db.storage.from('forum-files').remove([path]).catch(() => {})
      };
    }
    if (mode === 'event') {
      const id = panel.querySelector('select[name="event_id"]').value;
      return id ? { fields: { kind: 'event', event_id: id } } : { error: 'Choose the event to announce.' };
    }
    if (mode === 'collab') {
      const v = (n) => panel.querySelector(`[name="${n}"]`).value.trim();
      const seen = new Set();
      const skills = v('collab_skills').split(',').map((s) => s.trim().slice(0, 40)).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase())).slice(0, 8);
      return { fields: { kind: 'collab', collab_need: v('collab_need'), collab_skills: skills, collab_where: v('collab_where') || null, collab_deadline: v('collab_deadline') || null } };
    }
    return null;
  };
  F.composeReset = () => setMode(null);

  // ---------------------------------------------------------------- showing rich posts in the feed
  const NEED_ICON = '🤝';
  F.hooks.post.push((card, post) => {
    const anchor = card.querySelector('.fm-eng') || card.querySelector('.fm-post-actions');
    const put = (node) => card.insertBefore(node, anchor || null);
    if (post.kind === 'collab') put(collabBlock(post));
    if (post.kind === 'poll') { const b = el('div', { class: 'fm-poll', 'data-poll': post.id }, [el('p', { class: 'fm-muted', text: 'Loading poll…' })]); b._post = post; put(b); }
    if (post.kind === 'event' && post.event_id) put(el('div', { class: 'fm-post-event-slot', 'data-event-slot': post.event_id }));
    if (post.attachment_path) put(fileBlock(post));
  });
  F.hooks.feed.push(async (posts) => {
    const polls = posts.filter((p) => p.kind === 'poll').map((p) => p.id);
    const events = [...new Set(posts.filter((p) => p.event_id).map((p) => p.event_id))];
    if (polls.length) {
      const { data } = await db.rpc('forum_poll_results', { p_ids: polls });
      polls.forEach((id) => document.querySelectorAll(`[data-poll="${id}"]`).forEach((box) => paintPoll(box, (data || []).filter((r) => r.post_id === id))));
    }
    if (events.length) {
      const { data } = await db.from('forum_events').select('id,title,starts_at,ends_at,time_zone,format,venue_name,city,country,cover_url,status,category').in('id', events);
      (data || []).forEach((e) => document.querySelectorAll(`[data-event-slot="${e.id}"]`).forEach((slot) => slot.replaceWith(eventBlock(e))));
      document.querySelectorAll('[data-event-slot]').forEach((slot) => slot.replaceWith(el('p', { class: 'fm-muted fm-post-event-gone', text: 'This event is no longer available.' })));
    }
  });

  function collabBlock(post) {
    const mine = post.author_id === state.me?.user_id;
    const due = post.collab_deadline ? new Date(`${post.collab_deadline}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    return el('div', { class: 'fm-collab' }, [
      el('div', { class: 'fm-collab-head' }, [el('span', { 'aria-hidden': 'true', text: NEED_ICON }), el('span', {}, [el('small', { text: 'Collaboration request · Looking for' }), el('strong', { text: NEEDS[post.collab_need] || 'Support' })])]),
      post.collab_skills?.length ? el('div', { class: 'fm-opp-tags' }, post.collab_skills.map((s) => el('span', { text: s }))) : null,
      (post.collab_where || due) ? el('p', { class: 'fm-small fm-muted', text: [post.collab_where ? `📍 ${post.collab_where}` : null, due ? `Respond by ${due}` : null].filter(Boolean).join(' · ') }) : null,
      !mine && state.me ? el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: "I'm interested", onclick: () => F.startMessage?.(post.author_id) }) : null
    ]);
  }

  function fileBlock(post) {
    const isVideo = post.attachment_kind === 'video';
    const box = el('div', { class: `fm-file${isVideo ? ' is-video' : ''}` });
    const signed = async (download) => {
      const { data } = await db.storage.from('forum-files').createSignedUrl(post.attachment_path, 600, download ? { download: post.attachment_name } : undefined);
      return data?.signedUrl || null;
    };
    if (isVideo) {
      const video = el('video', { class: 'fm-post-video', controls: '', playsinline: '', preload: 'metadata', controlsList: 'nodownload' });
      signed(false).then((u) => { if (u) video.src = u; else box.replaceChildren(el('p', { class: 'fm-muted', text: 'This video is not available.' })); });
      box.append(video);
      return box;
    }
    const open = async (download) => { const u = await signed(download); if (u) window.open(u, '_blank', 'noopener'); };
    box.append(
      el('span', { class: 'fm-file-badge', 'aria-hidden': 'true', text: 'PDF' }),
      el('span', { class: 'fm-file-text' }, [el('strong', { text: post.attachment_name }), el('small', { text: `PDF document · ${sizeText(post.attachment_size || 0)}` })]),
      el('span', { class: 'fm-file-actions' }, [
        el('button', { class: 'fm-chip-btn', type: 'button', text: 'Open', onclick: () => open(false) }),
        el('button', { class: 'fm-chip-btn', type: 'button', text: 'Download', onclick: () => open(true) })
      ])
    );
    return box;
  }

  function eventBlock(e) {
    const cover = typeof e.cover_url === 'string' && e.cover_url.startsWith('https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/') ? e.cover_url : null;
    const fmt = (opts) => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: e.time_zone, ...opts }).format(new Date(e.starts_at)); } catch { return new Date(e.starts_at).toLocaleString(); } };
    const where = e.format === 'online' ? 'Online' : [e.venue_name, e.city, e.country].filter(Boolean).join(', ');
    return el('a', { class: 'fm-post-event', href: `#events/${e.id}` }, [
      cover ? el('img', { src: cover, alt: '', loading: 'lazy' }) : null,
      el('span', { class: 'fm-post-event-body' }, [
        el('span', { class: 'fm-post-event-date' }, [el('b', { text: fmt({ day: 'numeric' }) }), el('small', { text: fmt({ month: 'short' }).toUpperCase() })]),
        el('span', { class: 'fm-post-event-text' }, [
          el('strong', { text: e.title }),
          el('small', { text: `${fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}${where ? ` · ${where}` : ''}` }),
          el('span', { class: 'fm-post-event-cta', text: e.status === 'cancelled' ? 'Cancelled' : 'View and register →' })
        ])
      ])
    ]);
  }

  function paintPoll(box, rows) {
    const post = box._post;
    const closed = new Date(post.poll_closes_at) <= new Date();
    const total = rows.reduce((n, r) => n + Number(r.votes), 0);
    const mine = rows.find((r) => r.mine);
    const showResults = closed || Boolean(mine) || post.author_id === state.me?.user_id;
    const status = el('p', { class: 'fm-status', role: 'status' });
    const vote = async (optionId) => {
      if (closed || !state.me) return;
      box.classList.add('is-busy');
      const { error } = await db.rpc('forum_poll_vote', { p_post: post.id, p_option: optionId });
      const { data } = await db.rpc('forum_poll_results', { p_ids: [post.id] });
      box.classList.remove('is-busy');
      paintPoll(box, data || rows);
      if (error) box.querySelector('.fm-status').textContent = error.message;
    };
    const left = Math.ceil((new Date(post.poll_closes_at) - Date.now()) / 3600000);
    const when = closed ? 'Poll closed' : left < 24 ? `${left} hour${left === 1 ? '' : 's'} left` : `${Math.ceil(left / 24)} days left`;
    box.replaceChildren(
      ...rows.map((r) => {
        const pct = total ? Math.round((Number(r.votes) / total) * 100) : 0;
        return showResults
          ? el('button', { type: 'button', class: `fm-poll-result${r.mine ? ' is-mine' : ''}`, 'aria-pressed': String(r.mine), onclick: () => vote(r.option_id) }, [
            el('i', { style: `width:${pct}%`, 'aria-hidden': 'true' }),
            el('span', { text: `${r.mine ? '✓ ' : ''}${r.label}` }),
            el('b', { text: `${pct}%` })
          ])
          : el('button', { type: 'button', class: 'fm-poll-opt', onclick: () => vote(r.option_id), text: r.label });
      }),
      el('p', { class: 'fm-poll-meta' }, [
        `${total} vote${total === 1 ? '' : 's'} · ${when}`,
        mine && !closed ? el('button', { class: 'fm-text-btn', type: 'button', text: '· Remove my vote', onclick: () => vote(null) }) : null
      ]),
      status
    );
    if (closed) box.querySelectorAll('.fm-poll-result').forEach((b) => { b.disabled = true; });
  }
})();
