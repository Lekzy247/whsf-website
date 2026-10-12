// WHSF Forum add-on: events (host an event, free registration with a ticket code, my tickets, check-in).
// Access rules live in the database (supabase/migrations/20261012_forum_events.sql).
// Routes: #events, #events/new, #events/edit/<id>, #events/<id>. Member text is inserted with textContent only.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar } = F;
  const IMAGE_PREFIX = 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/';
  const FORMATS = { in_person: 'In person', online: 'Online', hybrid: 'In person + online' };
  const COLS = 'id,host_id,title,about,format,starts_at,ends_at,time_zone,venue_name,address,city,country,livestream_url,capacity,cover_url,status,review_note';
  const myZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const root = () => $('[data-fm-events]');

  const fmt = (iso, zone, opts) => {
    try { return new Intl.DateTimeFormat('en-US', { timeZone: zone, ...opts }).format(new Date(iso)); }
    catch { return new Date(iso).toLocaleString(); }
  };
  const when = (e) => {
    const day = fmt(e.starts_at, e.time_zone, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const t1 = fmt(e.starts_at, e.time_zone, { hour: 'numeric', minute: '2-digit' });
    const t2 = fmt(e.ends_at, e.time_zone, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    return `${day} · ${t1} – ${t2}`;
  };
  const localWhen = (e) => (e.time_zone === myZone ? '' : `Your time: ${fmt(e.starts_at, myZone, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`);
  const where = (e) => (e.format === 'online' ? 'Online' : [e.venue_name, e.city, e.country].filter(Boolean).join(', ') || FORMATS[e.format]);
  const safeCover = (u) => (typeof u === 'string' && u.startsWith(IMAGE_PREFIX) ? u : null);
  const dateBadge = (e) => el('span', { class: 'fm-ev-date', 'aria-hidden': 'true' }, [
    el('b', { text: fmt(e.starts_at, e.time_zone, { day: 'numeric' }) }),
    el('small', { text: fmt(e.starts_at, e.time_zone, { month: 'short' }).toUpperCase() })
  ]);
  const statusChip = (s) => (s === 'published' ? null : el('span', { class: `fm-chip is-${s}`, text: { pending: 'Waiting for WHSF approval', rejected: 'Not approved', cancelled: 'Cancelled' }[s] || s }));
  const back = () => el('a', { class: 'fm-text-btn', href: '#events', text: '← All events' });

  async function hostNames(ids) {
    const map = new Map();
    const uniq = [...new Set(ids)].filter(Boolean);
    if (!uniq.length) return map;
    const { data } = await db.from('forum_profiles').select('user_id,display_name,headline,avatar_url').in('user_id', uniq);
    (data || []).forEach((p) => map.set(p.user_id, p));
    return map;
  }
  async function counts(ids) {
    const map = new Map();
    if (!ids.length) return map;
    const { data } = await db.rpc('forum_event_counts', { p_ids: ids });
    (data || []).forEach((r) => map.set(r.event_id, Number(r.going)));
    return map;
  }

  function card(e, extra) {
    const cover = safeCover(e.cover_url);
    return el('a', { class: 'fm-ev-card', href: `#events/${e.id}` }, [
      cover ? el('img', { src: cover, alt: '', loading: 'lazy' }) : el('span', { class: 'fm-ev-cover', 'aria-hidden': 'true' }),
      el('span', { class: 'fm-ev-body' }, [
        dateBadge(e),
        el('span', {}, [
          el('strong', { text: e.title }),
          el('small', { text: when(e) }),
          el('small', { text: `${FORMATS[e.format]} · ${where(e)}` }),
          extra || null,
          statusChip(e.status)
        ])
      ])
    ]);
  }

  // ---------------------------------------------------------------- list: #events
  async function renderList() {
    const box = root();
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading events…' }));
    const nowIso = new Date().toISOString();
    const [{ data: upcoming }, { data: mine }, { data: tickets }, staffQ] = await Promise.all([
      db.from('forum_events').select(COLS).eq('status', 'published').gte('ends_at', nowIso).order('starts_at').limit(40),
      db.from('forum_events').select(COLS).eq('host_id', state.me.user_id).order('starts_at', { ascending: false }).limit(20),
      db.from('forum_tickets').select('id,code,status,event_id,forum_events(' + COLS + ')').eq('holder_id', state.me.user_id).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(30),
      state.isStaff ? db.from('forum_events').select(COLS).eq('status', 'pending').order('created_at').limit(30) : Promise.resolve({ data: [] })
    ]);
    const all = [...(upcoming || []), ...(mine || []), ...(staffQ.data || [])];
    const going = await counts([...new Set(all.map((e) => e.id))]);
    const goingText = (e) => el('small', { class: 'fm-ev-going', text: `${going.get(e.id) || 0} going${e.capacity ? ` · ${Math.max(0, e.capacity - (going.get(e.id) || 0))} places left` : ''}` });

    box.replaceChildren(
      el('div', { class: 'fm-ev-head' }, [
        el('div', {}, [el('h2', { text: 'Events' }), el('p', { class: 'fm-muted', text: 'Workshops, meetups and webinars hosted by WHSF and verified members. Registration is free.' })]),
        el('a', { class: 'hp-btn hp-btn-primary', href: '#events/new', text: 'Host an event' })
      ])
    );
    if (state.isStaff && staffQ.data?.length) {
      box.append(el('h3', { class: 'fm-ev-section', text: `Waiting for your approval (${staffQ.data.length})` }));
      const grid = el('div', { class: 'fm-ev-grid' });
      staffQ.data.forEach((e) => grid.append(card(e)));
      box.append(grid);
    }
    const myTickets = (tickets || []).filter((t) => t.forum_events && new Date(t.forum_events.ends_at) > new Date());
    box.append(el('h3', { class: 'fm-ev-section', id: 'my-tickets', text: 'My tickets' }));
    if (!myTickets.length) box.append(el('p', { class: 'fm-muted', text: 'You have not registered for any upcoming events yet.' }));
    else {
      const grid = el('div', { class: 'fm-ev-grid' });
      myTickets.forEach((t) => grid.append(card(t.forum_events, el('small', { class: 'fm-ev-ticket', text: `Ticket ${t.code}${t.status === 'checked_in' ? ' · checked in' : ''}` }))));
      box.append(grid);
    }
    box.append(el('h3', { class: 'fm-ev-section', text: 'Events I host' }));
    if (!mine?.length) box.append(el('p', { class: 'fm-muted', text: 'You are not hosting any events. Press "Host an event" to create one. WHSF checks every new event before members can see it.' }));
    else {
      const grid = el('div', { class: 'fm-ev-grid' });
      mine.forEach((e) => grid.append(card(e, goingText(e))));
      box.append(grid);
    }
    box.append(el('h3', { class: 'fm-ev-section', text: 'Upcoming events' }));
    const others = (upcoming || []).filter((e) => e.host_id !== state.me.user_id);
    if (!others.length) box.append(el('p', { class: 'fm-muted', text: 'No upcoming events yet. Be the first to host one!' }));
    else {
      const grid = el('div', { class: 'fm-ev-grid' });
      others.forEach((e) => grid.append(card(e, goingText(e))));
      box.append(grid);
    }
  }

  // ---------------------------------------------------------------- detail: #events/<id>
  async function renderDetail(id) {
    const box = root();
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading event…' }));
    const { data: e } = await db.from('forum_events').select(COLS).eq('id', id).maybeSingle();
    if (!e) { box.replaceChildren(back(), el('p', { text: 'This event is not available. It may still be waiting for WHSF approval.' })); return; }
    const isHost = e.host_id === state.me.user_id;
    const [hosts, going, { data: ticket }, { data: priv }] = await Promise.all([
      hostNames([e.host_id]), counts([e.id]),
      db.from('forum_tickets').select('id,code,status').eq('event_id', e.id).eq('holder_id', state.me.user_id).neq('status', 'cancelled').maybeSingle(),
      db.from('forum_event_private').select('meeting_link').eq('event_id', e.id).maybeSingle()
    ]);
    const host = hosts.get(e.host_id) || { display_name: 'Member' };
    const n = going.get(e.id) || 0;
    const ended = new Date(e.ends_at) < new Date();
    const status = el('p', { class: 'fm-status', role: 'status' });
    const avatar = el('span', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(avatar, host);
    const cover = safeCover(e.cover_url);

    const action = el('div', { class: 'fm-ev-action' });
    if (e.status !== 'published') {
      action.append(statusChip(e.status));
      if (e.review_note) action.append(el('p', { class: 'fm-muted', text: `WHSF note: ${e.review_note}` }));
    } else if (isHost) {
      action.append(el('p', { class: 'fm-muted', text: `You are hosting · ${n} registered` }));
    } else if (ticket) {
      const qr = el('canvas', { width: '140', height: '140', 'aria-label': `QR code for ticket ${ticket.code}` });
      action.append(el('div', { class: 'fm-ticket' }, [
        qr,
        el('div', {}, [
          el('strong', { text: ticket.status === 'checked_in' ? 'You are checked in' : 'You are going!' }),
          el('p', { text: `Ticket code: ${ticket.code}` }),
          el('small', { class: 'fm-muted', text: 'Show this code or QR at the door.' }),
          priv?.meeting_link ? el('a', { class: 'hp-btn hp-btn-primary', href: priv.meeting_link, target: '_blank', rel: 'noopener noreferrer', text: 'Join online' }) : null,
          ticket.status === 'registered' && !ended ? el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel my registration', onclick: () => confirmBox(action, 'Cancel your registration?', async () => {
            const { error } = await db.rpc('forum_ticket_cancel', { p_ticket: ticket.id });
            if (error) status.textContent = error.message; else renderDetail(e.id);
          }) }) : null
        ])
      ]));
      if (window.QRCode?.toCanvas) window.QRCode.toCanvas(qr, ticket.code, { width: 140, margin: 1, color: { dark: '#2a0a17', light: '#ffffff' } }).catch(() => {});
    } else if (ended) {
      action.append(el('p', { class: 'fm-muted', text: 'This event has ended.' }));
    } else if (e.capacity && n >= e.capacity) {
      action.append(el('p', { class: 'fm-muted', text: 'This event is full.' }));
    } else {
      action.append(el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Register (free)', onclick: async (ev) => {
        ev.currentTarget.disabled = true;
        const { error } = await db.rpc('forum_event_register', { p_event: e.id });
        if (error) { status.textContent = error.message; ev.currentTarget.disabled = false; return; }
        renderDetail(e.id);
      } }));
    }

    const hostTools = el('div', { class: 'fm-ev-host' });
    if (isHost || state.isStaff) {
      if (isHost && e.status !== 'cancelled') hostTools.append(el('a', { class: 'hp-btn hp-btn-outline', href: `#events/edit/${e.id}`, text: 'Edit event' }));
      if (isHost && ['pending', 'published'].includes(e.status) && !ended) {
        hostTools.append(el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel event', onclick: () => confirmBox(hostTools, 'Cancel this event? Everyone registered will get an alert.', async () => {
          const { error } = await db.from('forum_events').update({ status: 'cancelled' }).eq('id', e.id);
          if (error) status.textContent = error.message; else renderDetail(e.id);
        }) }));
      }
      if (state.isStaff && e.status === 'pending') hostTools.append(reviewBox(e, status));
      if (e.status === 'published') hostTools.append(await attendees(e));
    }

    box.replaceChildren(
      back(),
      el('article', { class: 'fm-ev-detail' }, [
        cover ? el('img', { class: 'fm-ev-hero', src: cover, alt: '' }) : el('div', { class: 'fm-ev-hero fm-ev-cover', 'aria-hidden': 'true' }),
        el('div', { class: 'fm-ev-detail-body' }, [
          el('h2', { text: e.title }),
          el('p', { class: 'fm-ev-when', text: when(e) }),
          localWhen(e) ? el('p', { class: 'fm-muted', text: localWhen(e) }) : null,
          el('p', { class: 'fm-ev-where', text: `${FORMATS[e.format]} · ${where(e)}${e.address && e.format !== 'online' ? ` · ${e.address}` : ''}` }),
          e.livestream_url ? el('p', {}, [el('a', { href: e.livestream_url, target: '_blank', rel: 'noopener noreferrer', text: 'Watch the livestream' })]) : null,
          el('p', { class: 'fm-ev-going', text: `${n} going${e.capacity ? ` · ${Math.max(0, e.capacity - n)} places left` : ''}` }),
          action,
          status,
          el('h3', { text: 'About this event' }),
          el('p', { class: 'fm-ev-about', text: e.about }),
          el('div', { class: 'fm-ev-hostline' }, [avatar, el('span', {}, [el('small', { text: 'Hosted by' }), el('strong', { text: host.display_name }), el('small', { text: host.headline || '' })])]),
          el('p', { class: 'fm-small fm-muted', text: 'WHSF checks events before they are listed, but please stay safe: never pay anyone to attend a free event and report anything suspicious to info@worldhsfoundation.org.' }),
          hostTools
        ])
      ])
    );
  }

  function confirmBox(anchor, text, onYes) {
    const box = el('div', { class: 'fm-confirm' }, [
      el('p', { text }),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Yes', onclick: () => { box.remove(); onYes(); } }),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'No', onclick: () => box.remove() })
      ])
    ]);
    anchor.append(box);
  }

  function reviewBox(e, status) {
    const note = el('input', { type: 'text', maxlength: '300', placeholder: 'Reason if rejecting (sent to the host)' });
    const decide = async (approve) => {
      const { error } = await db.rpc('forum_event_review', { p_event: e.id, p_approve: approve, p_note: note.value });
      if (error) status.textContent = error.message; else renderDetail(e.id);
    };
    return el('div', { class: 'fm-ev-review' }, [
      el('h3', { text: 'Moderator review' }),
      el('p', { class: 'fm-muted', text: 'Approve only genuine events: no fees for free events, no requests for money or bank details, and a clear host.' }),
      el('div', { class: 'fm-form' }, [el('label', {}, [document.createTextNode('Reason if rejecting'), note])]),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Approve event', onclick: () => decide(true) }),
        el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Reject', onclick: () => decide(false) })
      ])
    ]);
  }

  async function attendees(e) {
    const wrap = el('div', { class: 'fm-ev-attendees' }, [el('h3', { text: 'Guests and check-in' })]);
    const { data: tickets } = await db.from('forum_tickets').select('code,status,holder_id,checked_in_at').eq('event_id', e.id).neq('status', 'cancelled').order('created_at');
    const names = await hostNames((tickets || []).map((t) => t.holder_id));
    const result = el('p', { class: 'fm-status', role: 'status' });
    const code = el('input', { type: 'text', placeholder: 'Ticket code, e.g. WHSF-1A2B3C4D', maxlength: '20', autocomplete: 'off' });
    wrap.append(el('form', { class: 'fm-checkin', onsubmit: async (ev) => {
      ev.preventDefault();
      if (!code.value.trim()) return;
      const { data, error } = await db.rpc('forum_check_in', { p_event: e.id, p_code: code.value });
      result.textContent = error ? error.message : `Checked in: ${data}`;
      if (!error) { code.value = ''; setTimeout(() => renderDetail(e.id), 900); }
    } }, [code, el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: 'Check in' })]), result);
    const list = el('ul', { class: 'fm-ev-guests' });
    (tickets || []).forEach((t) => list.append(el('li', {}, [
      el('span', { text: names.get(t.holder_id)?.display_name || 'Member' }),
      el('small', { text: `${t.code}${t.status === 'checked_in' ? ' · checked in' : ''}` })
    ])));
    if (!tickets?.length) list.append(el('li', { class: 'fm-muted', text: 'No guests yet.' }));
    wrap.append(el('p', { class: 'fm-muted', text: `${(tickets || []).length} registered · ${(tickets || []).filter((t) => t.status === 'checked_in').length} checked in` }), list);
    return wrap;
  }

  // ---------------------------------------------------------------- host form: #events/new, #events/edit/<id>
  const toLocalInput = (iso) => {
    const d = new Date(iso);
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  async function renderForm(id) {
    const box = root();
    let e = null; let link = '';
    if (id) {
      const { data } = await db.from('forum_events').select(COLS).eq('id', id).eq('host_id', state.me.user_id).maybeSingle();
      if (!data) { box.replaceChildren(back(), el('p', { text: 'You can only edit events you host.' })); return; }
      e = data;
      const { data: p } = await db.from('forum_event_private').select('meeting_link').eq('event_id', id).maybeSingle();
      link = p?.meeting_link || '';
    }
    const field = (label, input, hint) => el('label', {}, [document.createTextNode(label), hint ? el('small', { text: ` ${hint}` }) : null, input]);
    const input = (name, attrs = {}) => el('input', { name, ...attrs });
    const f = el('form', { class: 'fm-form fm-ev-form', novalidate: '' });
    const fmtSel = el('select', { name: 'format' }, Object.entries(FORMATS).map(([v, t]) => el('option', { value: v, text: t })));
    const about = el('textarea', { name: 'about', rows: '6', maxlength: '4000', placeholder: 'Who it is for, the agenda, speakers, and what attendees will gain.' });
    const cover = el('input', { type: 'file', name: 'cover', accept: 'image/jpeg,image/png,image/webp' });
    const status = el('p', { class: 'fm-status', role: 'status' });
    f.append(
      field('Event title', input('title', { maxlength: '120', required: '', placeholder: 'e.g. MIL Lab: spotting deepfakes workshop' })),
      field('About the event', about),
      field('Format', fmtSel),
      el('div', { class: 'fm-two' }, [
        field('Starts', input('starts', { type: 'datetime-local', required: '' })),
        field('Ends', input('ends', { type: 'datetime-local', required: '' }))
      ]),
      el('p', { class: 'fm-small fm-muted', text: `Times are in your time zone: ${myZone}.` }),
      el('div', { 'data-ev-place': '' }, [
        field('Venue name', input('venue_name', { maxlength: '120', placeholder: 'e.g. WHSF Learning Centre' })),
        field('Address', input('address', { maxlength: '200', placeholder: 'Street and area' })),
        el('div', { class: 'fm-two' }, [field('City', input('city', { maxlength: '80' })), field('Country', input('country', { maxlength: '80' }))])
      ]),
      el('div', { 'data-ev-online': '' }, [
        field('Private meeting link', input('meeting_link', { type: 'url', maxlength: '500', placeholder: 'https://meet.google.com/…' }), '(only registered guests see it)'),
        field('Public livestream', input('livestream_url', { type: 'url', maxlength: '500', placeholder: 'https://www.youtube.com/live/…' }), '(optional)')
      ]),
      field('Maximum guests', input('capacity', { type: 'number', min: '1', max: '100000', placeholder: 'Leave empty for no limit' }), '(optional)'),
      field('Cover image', cover, '(optional, JPG/PNG/WebP up to 5 MB)'),
      el('p', { class: 'fm-small fm-muted', text: 'WHSF checks every new event before members can see it. Events must be free to attend; never ask guests for money or bank details.' }),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: e ? 'Save changes' : 'Submit for approval' }),
        el('a', { class: 'fm-text-btn', href: e ? `#events/${e.id}` : '#events', text: 'Cancel' })
      ]),
      status
    );
    const syncFormat = () => {
      f.querySelector('[data-ev-place]').hidden = fmtSel.value === 'online';
      f.querySelector('[data-ev-online]').hidden = fmtSel.value === 'in_person';
    };
    fmtSel.addEventListener('change', syncFormat);
    if (e) {
      const fe = f.elements;
      fe.title.value = e.title; about.value = e.about; fmtSel.value = e.format;
      fe.starts.value = toLocalInput(e.starts_at); fe.ends.value = toLocalInput(e.ends_at);
      ['venue_name', 'address', 'city', 'country', 'livestream_url'].forEach((k) => { fe[k].value = e[k] || ''; });
      fe.capacity.value = e.capacity || ''; fe.meeting_link.value = link;
    }
    syncFormat();

    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const say = (t) => { status.textContent = t; };
      const v = (k) => f.elements[k].value.trim();
      if (v('title').length < 3) return say('Give your event a title.');
      if (about.value.trim().length < 20) return say('Tell people more about the event (at least 20 characters).');
      if (!v('starts') || !v('ends')) return say('Add a start and end time.');
      const starts = new Date(v('starts')); const ends = new Date(v('ends'));
      if (!(ends > starts)) return say('The end time must be after the start time.');
      if (!e && starts < new Date()) return say('The event must start in the future.');
      const isUrl = (s) => !s || /^https:\/\/\S+$/.test(s);
      if (!isUrl(v('meeting_link')) || !isUrl(v('livestream_url'))) return say('Links must start with https://');
      if (fmtSel.value !== 'in_person' && !v('meeting_link') && !v('livestream_url')) return say('Add a meeting link or livestream for online events.');
      if (fmtSel.value !== 'online' && !v('city')) return say('Add the city for in-person events.');
      const button = f.querySelector('button[type="submit"]');
      button.disabled = true;
      let coverUrl = e?.cover_url || null;
      const file = cover.files[0];
      if (file) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { button.disabled = false; return say('Cover must be JPG, PNG or WebP up to 5 MB.'); }
        const path = `${state.me.user_id}/${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
        const { error } = await db.storage.from('forum-images').upload(path, file, { contentType: file.type, upsert: false });
        if (error) { button.disabled = false; return say('Cover upload failed. Please try again.'); }
        coverUrl = `${IMAGE_PREFIX}${path}`;
      }
      const online = fmtSel.value !== 'in_person';
      const place = fmtSel.value !== 'online';
      const row = {
        title: v('title'), about: about.value.trim(), format: fmtSel.value,
        starts_at: starts.toISOString(), ends_at: ends.toISOString(), time_zone: myZone,
        venue_name: place ? v('venue_name') || null : null, address: place ? v('address') || null : null,
        city: place ? v('city') || null : null, country: place ? v('country') || null : null,
        livestream_url: online ? v('livestream_url') || null : null,
        capacity: v('capacity') ? Number(v('capacity')) : null, cover_url: coverUrl
      };
      let eventId = e?.id;
      if (e) {
        const { error } = await db.from('forum_events').update(row).eq('id', e.id);
        if (error) { button.disabled = false; return say(error.message); }
      } else {
        const { data, error } = await db.from('forum_events').insert({ ...row, host_id: state.me.user_id }).select('id').single();
        if (error) { button.disabled = false; return say(error.message); }
        eventId = data.id;
      }
      const meeting = online ? v('meeting_link') || null : null;
      const { error: linkError } = await db.from('forum_event_private').upsert({ event_id: eventId, meeting_link: meeting });
      if (linkError) { button.disabled = false; return say(`Saved, but the meeting link could not be stored: ${linkError.message}`); }
      location.hash = `#events/${eventId}`;
    });

    box.replaceChildren(
      back(),
      el('div', { class: 'fm-ev-formwrap' }, [
        el('h2', { text: e ? 'Edit event' : 'Host an event' }),
        el('p', { class: 'fm-muted', text: 'Share a workshop, meetup or webinar with the WHSF community. Registration is free for guests.' }),
        f
      ])
    );
  }

  // ---------------------------------------------------------------- routing
  function route() {
    if (!state.me) return;
    const parts = (location.hash || '').slice(1).split('/');
    if (parts[0] !== 'events') return;
    if (parts[1] === 'new') renderForm(null);
    else if (parts[1] === 'edit' && parts[2]) renderForm(parts[2]);
    else if (parts[1] && /^[0-9a-f-]{36}$/.test(parts[1])) renderDetail(parts[1]);
    else renderList();
  }
  F.hooks.view.push((view) => { if (view === 'events') route(); });
})();
