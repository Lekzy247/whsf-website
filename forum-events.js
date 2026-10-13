// WHSF Forum add-on: events built to the standard of international side events (UN-style).
// Hosts publish a full event page (type, theme, organisers, SDGs, programme, speakers, languages,
// accessibility, documents); guests register with their participant details; hosts approve, manage a
// waitlist, export the list and check people in with a ticket QR code.
// Access rules live in the database (supabase/migrations/20261012_forum_events.sql and
// 20261013_forum_events_standard.sql). Routes: #events, #events/new, #events/edit/<id>, #events/<id>.
// Member text is inserted with textContent only.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar } = F;
  const IMAGE_PREFIX = 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/';
  const FORMATS = { in_person: 'In person', online: 'Online', hybrid: 'Hybrid (in person + online)' };
  // Event types (must match forum_events.category in the database).
  const CATS = {
    side_event: '📌 Side event', high_level: '🌐 High-level event', conference: '🎤 Conference', summit: '🏛️ Summit',
    panel: '🎙️ Panel discussion', roundtable: '🔵 Roundtable', launch: '📘 Report launch', training: '🎓 Training',
    webinar: '💻 Webinar', workshop: '🛠️ Workshop', exchange: '🌍 Exchange programme', career_fair: '💼 Career fair',
    networking: '🤝 Networking', meetup: '☕ Meetup'
  };
  const PTYPES = {
    member_state: 'Government / Member State delegation', un_system: 'United Nations system', igo: 'Intergovernmental organisation',
    ngo: 'NGO / civil society', academia: 'Academia / research', private_sector: 'Private sector', media: 'Media',
    individual: 'Individual', other: 'Other'
  };
  const ACCESS = {
    wheelchair: 'Wheelchair-accessible venue', captions: 'Live captions', sign_language: 'Sign language interpretation',
    accessible_documents: 'Accessible documents', hearing_loop: 'Hearing loop', quiet_room: 'Quiet room'
  };
  const LANGS = ['English', 'French', 'Spanish', 'Arabic', 'Chinese', 'Russian', 'Portuguese', 'Swahili'];
  const SDGS = ['No poverty', 'Zero hunger', 'Good health and well-being', 'Quality education', 'Gender equality',
    'Clean water and sanitation', 'Affordable and clean energy', 'Decent work and economic growth',
    'Industry, innovation and infrastructure', 'Reduced inequalities', 'Sustainable cities and communities',
    'Responsible consumption and production', 'Climate action', 'Life below water', 'Life on land',
    'Peace, justice and strong institutions', 'Partnerships for the goals'];
  const ROLES = ['Opening remarks', 'Keynote', 'Moderator', 'Speaker', 'Panellist', 'Discussant', 'Closing remarks'];
  const TICKET_LABEL = { registered: 'Confirmed', checked_in: 'Checked in', pending: 'Waiting for the organiser', waitlisted: 'On the waitlist', declined: 'Not accepted', cancelled: 'Cancelled' };
  let catFilter = null;
  const COLS = 'id,host_id,category,title,theme,parent_event,about,format,starts_at,ends_at,time_zone,venue_name,address,city,country,livestream_url,capacity,cover_url,status,review_note,organizer_name,co_organizers,sdgs,languages,interpretation,accessibility,registration_deadline,approval_required,contact_email,concept_note_url,report_url,recording_url,hashtag,agenda,speakers';
  const myZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const root = () => $('[data-fm-events]');

  // ---------------------------------------------------------------- time helpers (event time zone + reader's time zone)
  const fmt = (iso, zone, opts) => {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...opts }).format(new Date(iso)); }
    catch { return new Date(iso).toLocaleString(); }
  };
  const when = (e) => {
    const day = fmt(e.starts_at, e.time_zone, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const t1 = fmt(e.starts_at, e.time_zone, { hour: '2-digit', minute: '2-digit' });
    const t2 = fmt(e.ends_at, e.time_zone, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    return `${day}, ${t1} – ${t2}`;
  };
  const shortWhen = (e) => `${fmt(e.starts_at, e.time_zone, { day: 'numeric', month: 'short', year: 'numeric' })} · ${fmt(e.starts_at, e.time_zone, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`;
  const localWhen = (e) => (e.time_zone === myZone ? '' : `Your time: ${fmt(e.starts_at, myZone, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`);
  // Offset (ms) of a time zone at a given instant.
  const zoneOffset = (date, zone) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
  };
  // "2026-11-03T10:00" in zone -> Date (UTC).
  const zonedToDate = (value, zone) => {
    const [d, t] = value.split('T'); const [y, mo, da] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi);
    let ms = guess - zoneOffset(new Date(guess), zone);
    ms = guess - zoneOffset(new Date(ms), zone);
    return new Date(ms);
  };
  const dateToZoned = (iso, zone) => {
    const d = new Date(iso); const local = new Date(d.getTime() + zoneOffset(d, zone));
    return local.toISOString().slice(0, 16);
  };
  const zones = () => { try { return Intl.supportedValuesOf('timeZone'); } catch { return [myZone, 'UTC', 'America/New_York', 'Europe/Geneva', 'Europe/London', 'Africa/Lagos', 'Africa/Nairobi', 'Asia/Bangkok']; } };

  const where = (e) => (e.format === 'online' ? 'Online' : [e.venue_name, e.city, e.country].filter(Boolean).join(', ') || FORMATS[e.format]);
  const safeCover = (u) => (typeof u === 'string' && u.startsWith(IMAGE_PREFIX) ? u : null);
  const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/\S+$/.test(u) ? u : null);
  const dateBadge = (e) => el('span', { class: 'fm-ev-date', 'aria-hidden': 'true' }, [
    el('b', { text: fmt(e.starts_at, e.time_zone, { day: 'numeric' }) }),
    el('small', { text: fmt(e.starts_at, e.time_zone, { month: 'short' }).toUpperCase() })
  ]);
  const statusChip = (s) => (s === 'published' ? null : el('span', { class: `fm-chip is-${s}`, text: { pending: 'Waiting for WHSF approval', rejected: 'Not approved', cancelled: 'Cancelled' }[s] || s }));
  const back = () => el('a', { class: 'fm-text-btn', href: '#events', text: '← All events' });
  const organiser = (e, host) => e.organizer_name || host?.display_name || 'WHSF Forum member';

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
    (data || []).forEach((r) => map.set(r.event_id, { going: Number(r.going), waitlisted: Number(r.waitlisted), pending: Number(r.pending) }));
    return map;
  }
  const seatsText = (e, c) => {
    const going = c?.going || 0;
    const parts = [`${going} registered`];
    if (e.capacity) parts.push(going >= e.capacity ? 'full, waitlist open' : `${e.capacity - going} places left`);
    if (c?.waitlisted) parts.push(`${c.waitlisted} on waitlist`);
    return parts.join(' · ');
  };

  function card(e, extra) {
    const cover = safeCover(e.cover_url);
    return el('a', { class: 'fm-ev-card', href: `#events/${e.id}` }, [
      cover ? el('img', { src: cover, alt: '', loading: 'lazy' }) : el('span', { class: 'fm-ev-cover', 'aria-hidden': 'true' }),
      el('span', { class: 'fm-ev-body' }, [
        dateBadge(e),
        el('span', {}, [
          el('small', { class: 'fm-ev-cat', text: CATS[e.category] || CATS.meetup }),
          el('strong', { text: e.title }),
          e.parent_event ? el('small', { text: `On the margins of ${e.parent_event}` }) : null,
          el('small', { text: shortWhen(e) }),
          el('small', { text: e.format === 'online' ? 'Online' : `${FORMATS[e.format].split(' (')[0]} · ${where(e)}` }),
          e.organizer_name ? el('small', { text: `Organised by ${e.organizer_name}` }) : null,
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
      db.from('forum_events').select(COLS).eq('status', 'published').gte('ends_at', nowIso).order('starts_at').limit(60),
      db.from('forum_events').select(COLS).eq('host_id', state.me.user_id).order('starts_at', { ascending: false }).limit(20),
      db.from('forum_tickets').select('id,code,status,event_id,forum_events(' + COLS + ')').eq('holder_id', state.me.user_id).not('status', 'in', '(cancelled,declined)').order('created_at', { ascending: false }).limit(30),
      state.isStaff ? db.from('forum_events').select(COLS).eq('status', 'pending').order('created_at').limit(30) : Promise.resolve({ data: [] })
    ]);
    const all = [...(upcoming || []), ...(mine || []), ...(staffQ.data || [])];
    const cmap = await counts([...new Set(all.map((e) => e.id))]);
    const seats = (e) => el('small', { class: 'fm-ev-going', text: seatsText(e, cmap.get(e.id)) });

    box.replaceChildren(
      el('div', { class: 'fm-ev-head' }, [
        el('div', {}, [el('h2', { text: 'Events' }), el('p', { class: 'fm-muted', text: 'Side events, conferences, panels, trainings and webinars by WHSF and verified members and partners. Registration is free.' })]),
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
    box.append(el('h3', { class: 'fm-ev-section', id: 'my-tickets', text: 'My registrations' }));
    if (!myTickets.length) box.append(el('p', { class: 'fm-muted', text: 'You have not registered for any upcoming events yet.' }));
    else {
      const grid = el('div', { class: 'fm-ev-grid' });
      myTickets.forEach((t) => grid.append(card(t.forum_events, el('small', { class: `fm-ev-ticket is-${t.status}`, text: `${TICKET_LABEL[t.status]}${['registered', 'checked_in'].includes(t.status) ? ` · Ticket ${t.code}` : ''}` }))));
      box.append(grid);
    }
    box.append(el('h3', { class: 'fm-ev-section', text: 'Events I host' }));
    if (!mine?.length) box.append(el('p', { class: 'fm-muted', text: 'You are not hosting any events. Press "Host an event" to create one. WHSF checks every new event before members can see it.' }));
    else {
      const grid = el('div', { class: 'fm-ev-grid' });
      mine.forEach((e) => {
        const c = cmap.get(e.id);
        grid.append(card(e, el('small', { class: 'fm-ev-going', text: `${seatsText(e, c)}${c?.pending ? ` · ${c.pending} to approve` : ''}` })));
      });
      box.append(grid);
    }
    box.append(el('h3', { class: 'fm-ev-section', text: 'Upcoming events' }));
    const present = new Set((upcoming || []).map((e) => e.category));
    box.append(el('div', { class: 'fm-topics fm-ev-cats', 'aria-label': 'Filter by event type' }, [
      el('button', { type: 'button', class: `fm-topic${catFilter ? '' : ' is-on'}`, text: 'All types', onclick: () => { catFilter = null; renderList(); } }),
      ...Object.entries(CATS).filter(([k]) => present.has(k) || catFilter === k).map(([k, t]) => el('button', { type: 'button', class: `fm-topic${catFilter === k ? ' is-on' : ''}`, text: t, onclick: () => { catFilter = k; renderList(); } }))
    ]));
    const others = (upcoming || []).filter((e) => e.host_id !== state.me.user_id && (!catFilter || e.category === catFilter));
    if (!others.length) box.append(el('p', { class: 'fm-muted', text: 'No upcoming events yet. Be the first to host one!' }));
    else {
      const grid = el('div', { class: 'fm-ev-grid' });
      others.forEach((e) => grid.append(card(e, seats(e))));
      box.append(grid);
    }
  }

  // ---------------------------------------------------------------- add to calendar
  const stampUtc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function calendarLinks(e) {
    const url = `${location.origin}${location.pathname}#events/${e.id}`;
    const details = `${e.theme ? `${e.theme}\n\n` : ''}Event page: ${url}`;
    const place = e.format === 'online' ? 'Online' : [e.venue_name, e.address, e.city, e.country].filter(Boolean).join(', ');
    const enc = encodeURIComponent;
    const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(e.title)}&dates=${stampUtc(e.starts_at)}/${stampUtc(e.ends_at)}&details=${enc(details)}&location=${enc(place)}`;
    const outlook = `https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=${enc(e.title)}&startdt=${enc(new Date(e.starts_at).toISOString())}&enddt=${enc(new Date(e.ends_at).toISOString())}&body=${enc(details)}&location=${enc(place)}`;
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
    const ics = () => {
      const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WHSF//Forum events//EN', 'BEGIN:VEVENT',
        `UID:${e.id}@worldhsfoundation.org`, `DTSTAMP:${stampUtc(new Date().toISOString())}`,
        `DTSTART:${stampUtc(e.starts_at)}`, `DTEND:${stampUtc(e.ends_at)}`, `SUMMARY:${esc(e.title)}`,
        `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(place)}`, `URL:${url}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = el('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })), download: 'whsf-event.ics' });
      document.body.append(a); a.click(); a.remove();
    };
    return el('div', { class: 'fm-ev-cal' }, [
      el('span', { class: 'fm-muted', text: 'Add to calendar:' }),
      el('a', { class: 'fm-share-btn', href: google, target: '_blank', rel: 'noopener noreferrer', text: 'Google' }),
      el('a', { class: 'fm-share-btn', href: outlook, target: '_blank', rel: 'noopener noreferrer', text: 'Outlook' }),
      el('button', { class: 'fm-share-btn', type: 'button', text: 'Apple / .ics', onclick: ics })
    ]);
  }

  // ---------------------------------------------------------------- registration form (participant details)
  function registrationForm(e, onDone) {
    const status = el('p', { class: 'fm-status', role: 'status' });
    const typeSel = el('select', { name: 'participant_type', required: '' }, [el('option', { value: '', text: 'Choose…' }), ...Object.entries(PTYPES).map(([v, t]) => el('option', { value: v, text: t }))]);
    const f = el('form', { class: 'fm-form fm-ev-reg', novalidate: '' }, [
      el('h3', { text: e.approval_required ? 'Request to attend' : 'Register' }),
      el('div', { class: 'fm-two' }, [
        el('label', {}, ['Organisation', el('input', { name: 'organization', maxlength: '160', required: '', placeholder: 'or "Independent"', autocomplete: 'organization' })]),
        el('label', {}, ['Job title', el('input', { name: 'job_title', maxlength: '120', autocomplete: 'organization-title' })])
      ]),
      el('div', { class: 'fm-two' }, [
        el('label', {}, ['Country', el('input', { name: 'country', maxlength: '80', required: '', autocomplete: 'country-name' })]),
        el('label', {}, ['Participating as', typeSel])
      ]),
      el('label', {}, ['Accessibility or interpretation needs', el('small', { text: ' (optional)' }), el('input', { name: 'access_needs', maxlength: '300', placeholder: 'e.g. wheelchair access, captions, French interpretation' })]),
      el('label', { class: 'fm-check' }, [el('input', { type: 'checkbox', name: 'consent' }), el('span', { text: `I agree that my name and these details are shared with the organiser (${e.organizer_name || 'the event host'}) and WHSF to manage this event.` })]),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: e.approval_required ? 'Send request' : 'Register (free)' }),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel', onclick: () => f.remove() })
      ]),
      status
    ]);
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = (k) => f.elements[k].value.trim();
      if (v('organization').length < 2) { status.textContent = 'Please enter your organisation (or "Independent").'; return; }
      if (v('country').length < 2) { status.textContent = 'Please enter your country.'; return; }
      if (!typeSel.value) { status.textContent = 'Please choose how you are participating.'; return; }
      if (!f.elements.consent.checked) { status.textContent = 'Please tick the box to agree to share your details with the organiser.'; return; }
      const btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
      const { error } = await db.rpc('forum_event_register_v2', { p_event: e.id, p_details: {
        organization: v('organization'), job_title: v('job_title'), country: v('country'), participant_type: typeSel.value,
        access_needs: v('access_needs'), consent: true
      } });
      btn.disabled = false;
      if (error) { status.textContent = error.message; return; }
      onDone();
    });
    return f;
  }

  // ---------------------------------------------------------------- detail: #events/<id>
  async function renderDetail(id) {
    const box = root();
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading event…' }));
    const { data: e } = await db.from('forum_events').select(COLS).eq('id', id).maybeSingle();
    if (!e) { box.replaceChildren(back(), el('p', { text: 'This event is not available. It may still be waiting for WHSF approval.' })); return; }
    const isHost = e.host_id === state.me.user_id;
    const [hosts, cmap, { data: ticket }, { data: priv }] = await Promise.all([
      hostNames([e.host_id]), counts([e.id]),
      db.from('forum_tickets').select('id,code,status').eq('event_id', e.id).eq('holder_id', state.me.user_id).neq('status', 'cancelled').maybeSingle(),
      db.from('forum_event_private').select('meeting_link').eq('event_id', e.id).maybeSingle()
    ]);
    const host = hosts.get(e.host_id) || { display_name: 'Member' };
    const c = cmap.get(e.id) || { going: 0, waitlisted: 0, pending: 0 };
    const ended = new Date(e.ends_at) < new Date();
    const closed = e.registration_deadline && new Date(e.registration_deadline) < new Date();
    const status = el('p', { class: 'fm-status', role: 'status' });
    const avatar = el('span', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(avatar, host);
    const cover = safeCover(e.cover_url);

    // Registration / ticket box
    const action = el('div', { class: 'fm-ev-action' });
    if (e.status !== 'published') {
      action.append(statusChip(e.status));
      if (e.review_note) action.append(el('p', { class: 'fm-muted', text: `WHSF note: ${e.review_note}` }));
    } else if (isHost) {
      action.append(el('p', { class: 'fm-muted', text: `You are the host · ${seatsText(e, c)}${c.pending ? ` · ${c.pending} waiting for your approval` : ''}` }));
    } else if (ticket && ['registered', 'checked_in'].includes(ticket.status)) {
      const qr = el('canvas', { width: '140', height: '140', 'aria-label': `QR code for ticket ${ticket.code}` });
      action.append(el('div', { class: 'fm-ticket' }, [
        qr,
        el('div', {}, [
          el('strong', { text: ticket.status === 'checked_in' ? 'You are checked in' : 'Your place is confirmed' }),
          el('p', { text: `Ticket code: ${ticket.code}` }),
          el('small', { class: 'fm-muted', text: 'Show this code or QR code at the entrance.' }),
          safeUrl(priv?.meeting_link) ? el('a', { class: 'hp-btn hp-btn-primary', href: priv.meeting_link, target: '_blank', rel: 'noopener noreferrer', text: 'Join online' }) : null,
          ticket.status === 'registered' && !ended ? el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel my registration', onclick: () => confirmBox(action, 'Cancel your registration?', async () => {
            const { error } = await db.rpc('forum_ticket_cancel', { p_ticket: ticket.id });
            if (error) status.textContent = error.message; else renderDetail(e.id);
          }) }) : null
        ])
      ]));
      if (window.QRCode?.toCanvas) window.QRCode.toCanvas(qr, ticket.code, { width: 140, margin: 1, color: { dark: '#2a0a17', light: '#ffffff' } }).catch(() => {});
    } else if (ticket && ['pending', 'waitlisted', 'declined'].includes(ticket.status)) {
      action.append(el('div', { class: `fm-ev-state is-${ticket.status}` }, [
        el('strong', { text: TICKET_LABEL[ticket.status] }),
        el('p', { class: 'fm-muted', text: {
          pending: 'The organiser reviews every request. You will get an alert when it is decided.',
          waitlisted: 'The event is full. If a place opens up you will be moved in automatically and alerted.',
          declined: 'The organiser could not offer you a place this time.'
        }[ticket.status] }),
        ticket.status !== 'declined' && !ended ? el('button', { class: 'fm-text-btn', type: 'button', text: 'Withdraw', onclick: () => confirmBox(action, 'Withdraw your request?', async () => {
          const { error } = await db.rpc('forum_ticket_cancel', { p_ticket: ticket.id });
          if (error) status.textContent = error.message; else renderDetail(e.id);
        }) }) : null
      ]));
    } else if (ended) {
      action.append(el('p', { class: 'fm-muted', text: 'This event has ended.' }));
    } else if (closed) {
      action.append(el('p', { class: 'fm-muted', text: 'Registration has closed.' }));
    } else {
      const full = e.capacity && c.going >= e.capacity && !e.approval_required;
      action.append(el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: e.approval_required ? 'Request to attend' : full ? 'Join the waitlist' : 'Register (free)', onclick: (ev) => {
        ev.currentTarget.hidden = true;
        action.append(registrationForm(e, () => renderDetail(e.id)));
      } }));
      if (e.registration_deadline) action.append(el('small', { class: 'fm-muted', text: `Registration closes ${fmt(e.registration_deadline, e.time_zone, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}` }));
    }

    // Host tools
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

    // Sections
    const section = (title, ...kids) => el('section', { class: 'fm-ev-sec' }, [el('h3', { text: title }), ...kids]);
    const agenda = Array.isArray(e.agenda) ? e.agenda : [];
    const speakers = Array.isArray(e.speakers) ? e.speakers : [];
    const docs = [['Concept note', e.concept_note_url], ['Livestream', e.livestream_url], ['Recording', e.recording_url], ['Outcome report', e.report_url]].filter(([, u]) => safeUrl(u));
    const facts = [
      ['Date and time', when(e) + (localWhen(e) ? `\n${localWhen(e)}` : '')],
      ['Format', FORMATS[e.format]],
      e.format !== 'online' ? ['Venue', [e.venue_name, e.address, e.city, e.country].filter(Boolean).join(', ')] : null,
      ['Languages', (e.languages || []).join(', ') + (e.interpretation ? `\nInterpretation: ${e.interpretation}` : '')],
      e.accessibility?.length ? ['Accessibility', e.accessibility.map((k) => ACCESS[k] || k).join(' · ')] : null,
      ['Places', seatsText(e, c) + (e.approval_required ? '\nRegistration is approved by the organiser' : '')],
      e.contact_email ? ['Contact', e.contact_email] : null,
      e.hashtag ? ['Hashtag', e.hashtag] : null
    ].filter(Boolean);

    box.replaceChildren(
      back(),
      el('article', { class: 'fm-ev-detail' }, [
        cover ? el('img', { class: 'fm-ev-hero', src: cover, alt: '' }) : el('div', { class: 'fm-ev-hero fm-ev-cover', 'aria-hidden': 'true' }),
        el('div', { class: 'fm-ev-detail-body' }, [
          el('div', { class: 'fm-ev-kicker' }, [
            el('span', { class: 'fm-ev-cat', text: CATS[e.category] || CATS.meetup }),
            e.parent_event ? el('span', { class: 'fm-ev-margins', text: `On the margins of ${e.parent_event}` }) : null
          ]),
          el('h2', { class: 'fm-ev-title', text: e.title }),
          e.theme ? el('p', { class: 'fm-ev-theme', text: e.theme }) : null,
          el('p', { class: 'fm-ev-when', text: when(e) }),
          localWhen(e) ? el('p', { class: 'fm-muted', text: localWhen(e) }) : null,
          el('p', { class: 'fm-ev-where', text: e.format === 'online' ? 'Online event' : `${FORMATS[e.format]} · ${where(e)}` }),
          el('p', { class: 'fm-ev-org' }, [
            el('span', { class: 'fm-muted', text: 'Organised by ' }), el('strong', { text: organiser(e, host) }),
            e.co_organizers?.length ? el('span', { class: 'fm-muted', text: ` in partnership with ${e.co_organizers.join(', ')}` }) : null
          ]),
          e.sdgs?.length ? el('div', { class: 'fm-ev-sdgs', 'aria-label': 'Sustainable Development Goals' },
            [...e.sdgs].sort((a, b) => a - b).map((n) => el('span', { class: `fm-sdg sdg-${n}`, title: `SDG ${n}: ${SDGS[n - 1]}`, text: `SDG ${n}` }))) : null,
          el('div', { class: 'fm-ev-layout' }, [
            el('aside', { class: 'fm-ev-aside', 'aria-label': 'Registration and practical information' }, [
              el('div', { class: 'fm-ev-panel' }, [
                action,
                status,
                e.status === 'published' ? calendarLinks(e) : null
              ]),
              el('div', { class: 'fm-ev-panel' }, [
                el('h3', { text: 'Practical information' }),
                el('dl', { class: 'fm-ev-facts' }, facts.flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })]))
              ])
            ]),
            el('div', { class: 'fm-ev-main' }, [
          section('About the event', el('p', { class: 'fm-ev-about', text: e.about })),
          agenda.length ? section('Programme', el('ol', { class: 'fm-ev-agenda' }, agenda.map((a) => el('li', {}, [
            el('span', { class: 'fm-ev-agenda-time', text: a.time || '' }),
            el('span', {}, [el('strong', { text: a.title || '' }), a.speakers ? el('small', { text: a.speakers }) : null])
          ])))) : null,
          speakers.length ? section('Speakers', el('ul', { class: 'fm-ev-speakers' }, speakers.map((s) => {
            const av = el('span', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(av, { display_name: s.name });
            return el('li', {}, [av, el('span', {}, [
              s.role ? el('small', { class: 'fm-ev-role', text: s.role }) : null,
              el('strong', { text: s.name || '' }),
              el('small', { text: [s.title, s.organization].filter(Boolean).join(', ') })
            ])]);
          }))) : null,
          docs.length ? section('Documents and media', el('div', { class: 'fm-ev-docs' }, docs.map(([label, u]) => el('a', { class: 'fm-share-btn', href: u, target: '_blank', rel: 'noopener noreferrer', text: `${label} ↗` })))) : null,
          el('div', { class: 'fm-ev-hostline' }, [avatar, el('span', {}, [el('small', { text: 'Event page created by' }), el('strong', { text: host.display_name }), el('small', { text: host.headline || '' })])]),
          el('p', { class: 'fm-small fm-muted', text: 'WHSF checks events before they are listed. Registration is always free: never pay anyone to attend, and report anything suspicious to info@worldhsfoundation.org.' })
            ])
          ]),
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
      el('p', { class: 'fm-muted', text: 'Approve only genuine events: a clear organiser, no fees, no requests for money or bank details. Check that any UN or partner names are used with permission.' }),
      el('div', { class: 'fm-form' }, [el('label', {}, ['Reason if rejecting', note])]),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Approve event', onclick: () => decide(true) }),
        el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Reject', onclick: () => decide(false) })
      ])
    ]);
  }

  // ---------------------------------------------------------------- host: registrations, approvals, export, check-in
  async function attendees(e) {
    const wrap = el('div', { class: 'fm-ev-attendees' }, [el('h3', { text: 'Registrations and check-in' })]);
    const { data: tickets } = await db.from('forum_tickets')
      .select('id,code,status,holder_id,checked_in_at,created_at,organization,job_title,country,participant_type,access_needs')
      .eq('event_id', e.id).neq('status', 'cancelled').order('created_at');
    const names = await hostNames((tickets || []).map((t) => t.holder_id));
    const rows = tickets || [];
    const result = el('p', { class: 'fm-status', role: 'status' });
    const code = el('input', { type: 'text', placeholder: 'Ticket code, e.g. WHSF-1A2B3C4D', maxlength: '20', autocomplete: 'off', 'aria-label': 'Ticket code' });
    const tally = (s) => rows.filter((t) => s.includes(t.status)).length;
    wrap.append(
      el('p', { class: 'fm-muted', text: `${tally(['registered', 'checked_in'])} confirmed · ${tally(['checked_in'])} checked in · ${tally(['pending'])} to approve · ${tally(['waitlisted'])} on waitlist` }),
      el('form', { class: 'fm-checkin', onsubmit: async (ev) => {
        ev.preventDefault();
        if (!code.value.trim()) return;
        const { data, error } = await db.rpc('forum_check_in', { p_event: e.id, p_code: code.value });
        result.textContent = error ? error.message : `Checked in: ${data}`;
        if (!error) { code.value = ''; setTimeout(() => renderDetail(e.id), 900); }
      } }, [code, el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: 'Check in' })]),
      result,
      rows.length ? el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Download list (CSV)', onclick: () => exportCsv(e, rows, names) }) : null
    );
    const list = el('ul', { class: 'fm-ev-guests' });
    rows.forEach((t) => {
      const decide = (approve) => async () => {
        const { error } = await db.rpc('forum_ticket_decide', { p_ticket: t.id, p_approve: approve });
        if (error) result.textContent = error.message; else renderDetail(e.id);
      };
      list.append(el('li', { class: `is-${t.status}` }, [
        el('span', {}, [
          el('strong', { text: names.get(t.holder_id)?.display_name || 'Member' }),
          el('small', { text: [t.job_title, t.organization, t.country].filter(Boolean).join(' · ') }),
          el('small', { text: `${PTYPES[t.participant_type] || ''}${t.access_needs ? ` · Needs: ${t.access_needs}` : ''}` })
        ]),
        el('span', { class: 'fm-ev-guest-side' }, [
          el('small', { class: `fm-ev-ticket is-${t.status}`, text: `${TICKET_LABEL[t.status]}${['registered', 'checked_in'].includes(t.status) ? ` · ${t.code}` : ''}` }),
          ['pending', 'waitlisted'].includes(t.status) ? el('span', { class: 'fm-actions' }, [
            el('button', { class: 'fm-text-btn', type: 'button', text: 'Approve', onclick: decide(true) }),
            el('button', { class: 'fm-text-btn', type: 'button', text: 'Decline', onclick: decide(false) })
          ]) : null
        ])
      ]));
    });
    if (!rows.length) list.append(el('li', { class: 'fm-muted', text: 'No registrations yet.' }));
    wrap.append(list);
    return wrap;
  }
  function exportCsv(e, rows, names) {
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formulas
      return `"${s.replace(/"/g, '""')}"`;
    };
    const head = ['Name', 'Organisation', 'Job title', 'Country', 'Participating as', 'Accessibility needs', 'Status', 'Ticket', 'Registered at', 'Checked in at'];
    const lines = [head.map(cell).join(',')].concat(rows.map((t) => [
      names.get(t.holder_id)?.display_name || '', t.organization, t.job_title, t.country, PTYPES[t.participant_type] || '',
      t.access_needs, TICKET_LABEL[t.status], t.code, t.created_at, t.checked_in_at || ''
    ].map(cell).join(',')));
    const a = el('a', { href: URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv' })), download: `whsf-event-registrations-${e.id.slice(0, 8)}.csv` });
    document.body.append(a); a.click(); a.remove();
  }

  // ---------------------------------------------------------------- host form: #events/new, #events/edit/<id>
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
    const field = (label, input, hint) => el('label', {}, [label, hint ? el('small', { text: ` ${hint}` }) : null, input]);
    const input = (name, attrs = {}) => el('input', { name, ...attrs });
    const fieldset = (legend, intro, ...kids) => el('fieldset', { class: 'fm-ev-fs' }, [el('legend', { text: legend }), intro ? el('p', { class: 'fm-small fm-muted', text: intro }) : null, ...kids]);
    const f = el('form', { class: 'fm-form fm-ev-form', novalidate: '' });
    const fmtSel = el('select', { name: 'format' }, Object.entries(FORMATS).map(([v, t]) => el('option', { value: v, text: t })));
    const catSel = el('select', { name: 'category' }, Object.entries(CATS).map(([v, t]) => el('option', { value: v, text: t })));
    const zoneSel = el('select', { name: 'time_zone' }, zones().map((z) => el('option', { value: z, text: z.replace(/_/g, ' ') })));
    zoneSel.value = e?.time_zone || myZone;
    const about = el('textarea', { name: 'about', rows: '7', maxlength: '4000', placeholder: 'Background, objectives, who should attend and expected outcomes.' });
    const cover = el('input', { type: 'file', name: 'cover', accept: 'image/jpeg,image/png,image/webp' });
    const coOrgs = el('textarea', { name: 'co_organizers', rows: '3', maxlength: '2000', placeholder: 'One organisation per line' });
    const status = el('p', { class: 'fm-status', role: 'status' });

    // Repeating rows: programme and speakers
    const repeater = (cls, makeRow, rows, addText) => {
      const list = el('div', { class: `fm-ev-rows ${cls}` });
      const add = (vals = {}) => {
        const row = makeRow(vals);
        row.append(el('button', { class: 'fm-text-btn fm-ev-row-x', type: 'button', 'aria-label': 'Remove row', text: 'Remove', onclick: () => row.remove() }));
        list.append(row);
      };
      (rows.length ? rows : [{}]).forEach(add);
      return { node: el('div', {}, [list, el('button', { class: 'fm-text-btn', type: 'button', text: addText, onclick: () => add() })]), list };
    };
    const agendaRows = repeater('is-agenda', (v) => el('div', { class: 'fm-ev-row' }, [
      el('input', { 'data-k': 'time', maxlength: '40', placeholder: '10:00–10:10', 'aria-label': 'Time', value: v.time || '' }),
      el('input', { 'data-k': 'title', maxlength: '300', placeholder: 'Item, e.g. Opening remarks', 'aria-label': 'Programme item', value: v.title || '' }),
      el('input', { 'data-k': 'speakers', maxlength: '300', placeholder: 'Speaker(s)', 'aria-label': 'Speakers for this item', value: v.speakers || '' })
    ]), Array.isArray(e?.agenda) ? e.agenda : [], '+ Add programme item');
    const speakerRows = repeater('is-speakers', (v) => {
      const role = el('select', { 'data-k': 'role', 'aria-label': 'Role' }, [el('option', { value: '', text: 'Role…' }), ...ROLES.map((r) => el('option', { value: r, text: r }))]);
      role.value = v.role || '';
      return el('div', { class: 'fm-ev-row' }, [
        el('input', { 'data-k': 'name', maxlength: '160', placeholder: 'Full name', 'aria-label': 'Speaker name', value: v.name || '' }),
        el('input', { 'data-k': 'title', maxlength: '160', placeholder: 'Title / position', 'aria-label': 'Speaker title', value: v.title || '' }),
        el('input', { 'data-k': 'organization', maxlength: '160', placeholder: 'Organisation', 'aria-label': 'Speaker organisation', value: v.organization || '' }),
        role
      ]);
    }, Array.isArray(e?.speakers) ? e.speakers : [], '+ Add speaker');
    const readRows = (list) => [...list.children].map((row) => Object.fromEntries([...row.querySelectorAll('[data-k]')].map((n) => [n.dataset.k, n.value.trim()]).filter(([, val]) => val))).filter((o) => Object.keys(o).length);

    const checks = (name, items, chosen) => el('div', { class: 'fm-ev-checks' }, items.map(([v, t]) => el('label', { class: 'fm-check' }, [
      (() => { const c = el('input', { type: 'checkbox', name, value: String(v) }); c.checked = chosen.includes(v); return c; })(),
      el('span', { text: t })
    ])));
    const langOther = input('lang_other', { maxlength: '120', placeholder: 'Other languages, comma separated' });
    const knownLangs = (e?.languages || ['English']).filter((l) => LANGS.includes(l));
    langOther.value = (e?.languages || []).filter((l) => !LANGS.includes(l)).join(', ');

    f.append(
      fieldset('1. The event', null,
        field('Type of event', catSel),
        field('Event title', input('title', { maxlength: '120', required: '', placeholder: 'e.g. Youth, AI and Information Integrity' })),
        field('Theme or subtitle', input('theme', { maxlength: '200', placeholder: 'One line that sums up the event' }), '(optional)'),
        field('On the margins of', input('parent_event', { maxlength: '160', placeholder: 'e.g. the High-level Political Forum 2027, UNGA 82, CSW71' }), '(optional, for side events)'),
        field('About the event', about, '(concept: background, objectives, audience, expected outcomes)'),
        field('Cover image', cover, '(optional, JPG/PNG/WebP up to 5 MB, wide 16:5 works best)')),
      fieldset('2. Organisers', 'Name the lead organiser and any partners. Only use the names or logos of the UN or other organisations with their permission.',
        field('Lead organiser', input('organizer_name', { maxlength: '160', placeholder: 'e.g. World Humanitarian Support Foundation' })),
        field('Co-organisers and partners', coOrgs, '(optional, up to 15)'),
        field('Contact email for this event', input('contact_email', { type: 'email', maxlength: '200', placeholder: 'events@your-organisation.org' }), '(optional, shown on the event page)')),
      fieldset('3. Date, time and place', null,
        el('div', { class: 'fm-two' }, [
          field('Starts', input('starts', { type: 'datetime-local', required: '' })),
          field('Ends', input('ends', { type: 'datetime-local', required: '' }))
        ]),
        field('Time zone of the event', zoneSel, '(the venue\'s local time; guests also see their own time)'),
        field('Format', fmtSel),
        el('div', { 'data-ev-place': '' }, [
          field('Venue', input('venue_name', { maxlength: '120', placeholder: 'e.g. Conference Room 6' })),
          field('Address', input('address', { maxlength: '200', placeholder: 'Building, street' })),
          el('div', { class: 'fm-two' }, [field('City', input('city', { maxlength: '80' })), field('Country', input('country', { maxlength: '80' }))])
        ]),
        el('div', { 'data-ev-online': '' }, [
          field('Private meeting link', input('meeting_link', { type: 'url', maxlength: '500', placeholder: 'https://teams.microsoft.com/… or Zoom / Google Meet' }), '(only confirmed guests see it)'),
          field('Public livestream', input('livestream_url', { type: 'url', maxlength: '500', placeholder: 'https://www.youtube.com/live/… or UN Web TV' }), '(optional)')
        ])),
      fieldset('4. Programme', 'List the running order: time, item and who speaks.', agendaRows.node),
      fieldset('5. Speakers', 'Add moderators, speakers and panellists with their titles and organisations.', speakerRows.node),
      fieldset('6. Languages and accessibility', null,
        el('p', { class: 'fm-small', text: 'Languages' }),
        checks('languages', LANGS.map((l) => [l, l]), knownLangs),
        field('Other languages', langOther, '(optional)'),
        field('Interpretation', input('interpretation', { maxlength: '200', placeholder: 'e.g. English, French and Spanish interpretation' }), '(optional)'),
        el('p', { class: 'fm-small', text: 'Accessibility' }),
        checks('accessibility', Object.entries(ACCESS), e?.accessibility || [])),
      fieldset('7. Sustainable Development Goals', 'Tick the SDGs this event contributes to.',
        checks('sdgs', SDGS.map((t, i) => [i + 1, `${i + 1}. ${t}`]), (e?.sdgs || []).map(Number))),
      fieldset('8. Registration', 'Registration is always free.',
        el('div', { class: 'fm-two' }, [
          field('Maximum guests', input('capacity', { type: 'number', min: '1', max: '100000', placeholder: 'No limit' }), '(optional; a waitlist opens when full)'),
          field('Registration closes', input('deadline', { type: 'datetime-local' }), '(optional, event time zone)')
        ]),
        el('label', { class: 'fm-check' }, [(() => { const c = el('input', { type: 'checkbox', name: 'approval_required' }); c.checked = Boolean(e?.approval_required); return c; })(),
          el('span', { text: 'I approve each registration myself (for invitation-style or limited-seat events)' })])),
      fieldset('9. Documents and media', null,
        field('Concept note', input('concept_note_url', { type: 'url', maxlength: '500', placeholder: 'https://… link to a PDF or document' }), '(optional)'),
        field('Hashtag', input('hashtag', { maxlength: '41', placeholder: '#MILLab' }), '(optional)'),
        el('div', { class: 'fm-two' }, [
          field('Recording', input('recording_url', { type: 'url', maxlength: '500', placeholder: 'https://… (after the event)' }), '(optional)'),
          field('Outcome report', input('report_url', { type: 'url', maxlength: '500', placeholder: 'https://… (after the event)' }), '(optional)')
        ])),
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
      fe.title.value = e.title; about.value = e.about; fmtSel.value = e.format; catSel.value = e.category || 'meetup';
      fe.starts.value = dateToZoned(e.starts_at, e.time_zone); fe.ends.value = dateToZoned(e.ends_at, e.time_zone);
      if (e.registration_deadline) fe.deadline.value = dateToZoned(e.registration_deadline, e.time_zone);
      ['theme', 'parent_event', 'organizer_name', 'contact_email', 'venue_name', 'address', 'city', 'country', 'livestream_url', 'interpretation', 'concept_note_url', 'hashtag', 'recording_url', 'report_url']
        .forEach((k) => { fe[k].value = e[k] || ''; });
      coOrgs.value = (e.co_organizers || []).join('\n');
      fe.capacity.value = e.capacity || ''; fe.meeting_link.value = link;
    } else {
      catSel.value = 'side_event';
    }
    syncFormat();

    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const say = (t) => { status.textContent = t; status.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
      const v = (k) => f.elements[k].value.trim();
      const zone = zoneSel.value;
      if (v('title').length < 3) return say('Give your event a title.');
      if (about.value.trim().length < 20) return say('Tell people more about the event (at least 20 characters).');
      if (!v('starts') || !v('ends')) return say('Add a start and end time.');
      const starts = zonedToDate(v('starts'), zone); const ends = zonedToDate(v('ends'), zone);
      if (!(ends > starts)) return say('The end time must be after the start time.');
      if (!e && starts < new Date()) return say('The event must start in the future.');
      const deadline = v('deadline') ? zonedToDate(v('deadline'), zone) : null;
      if (deadline && deadline > ends) return say('Registration must close before the event ends.');
      const isUrl = (s) => !s || /^https:\/\/\S+$/.test(s);
      if (!['meeting_link', 'livestream_url', 'concept_note_url', 'recording_url', 'report_url'].every((k) => isUrl(v(k)))) return say('Links must start with https://');
      if (fmtSel.value !== 'in_person' && !v('meeting_link') && !v('livestream_url')) return say('Add a meeting link or livestream for online and hybrid events.');
      if (fmtSel.value !== 'online' && !v('city')) return say('Add the city for in-person and hybrid events.');
      if (v('contact_email') && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v('contact_email'))) return say('Check the contact email address.');
      let tag = v('hashtag'); if (tag && !tag.startsWith('#')) tag = `#${tag}`;
      if (tag && !/^#[A-Za-z0-9_]{2,40}$/.test(tag)) return say('A hashtag can only use letters, numbers and _ (e.g. #MILLab).');
      const partners = coOrgs.value.split('\n').map((s) => s.trim()).filter(Boolean);
      if (partners.length > 15) return say('Add up to 15 co-organisers.');
      const langs = [...f.querySelectorAll('input[name="languages"]:checked')].map((c) => c.value)
        .concat(v('lang_other').split(',').map((s) => s.trim()).filter(Boolean)).slice(0, 8);
      if (!langs.length) return say('Choose at least one language.');
      const agenda = readRows(agendaRows.list); const speakers = readRows(speakerRows.list);
      if (agenda.some((a) => !a.title)) return say('Each programme item needs a title.');
      if (speakers.some((s) => !s.name)) return say('Each speaker needs a name.');
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
      const orNull = (k) => v(k) || null;
      const row = {
        title: v('title'), theme: orNull('theme'), parent_event: orNull('parent_event'), about: about.value.trim(),
        format: fmtSel.value, category: catSel.value,
        starts_at: starts.toISOString(), ends_at: ends.toISOString(), time_zone: zone,
        venue_name: place ? orNull('venue_name') : null, address: place ? orNull('address') : null,
        city: place ? orNull('city') : null, country: place ? orNull('country') : null,
        livestream_url: online ? orNull('livestream_url') : null,
        capacity: v('capacity') ? Number(v('capacity')) : null, cover_url: coverUrl,
        organizer_name: orNull('organizer_name'), co_organizers: partners, contact_email: orNull('contact_email'),
        sdgs: [...f.querySelectorAll('input[name="sdgs"]:checked')].map((c) => Number(c.value)),
        languages: langs, interpretation: orNull('interpretation'),
        accessibility: [...f.querySelectorAll('input[name="accessibility"]:checked')].map((c) => c.value),
        registration_deadline: deadline ? deadline.toISOString() : null,
        approval_required: f.elements.approval_required.checked,
        concept_note_url: orNull('concept_note_url'), recording_url: orNull('recording_url'), report_url: orNull('report_url'),
        hashtag: tag || null, agenda, speakers
      };
      let eventId = e?.id;
      if (e) {
        const { error } = await db.from('forum_events').update(row).eq('id', e.id);
        if (error) { button.disabled = false; return say(error.message); }
      } else {
        const { data, error } = await db.from('forum_events').insert({ ...row, host_id: state.me.user_id }).select('id').single();
        if (error) { button.disabled = false; return say(error.message); }
        eventId = data.id;
        F.alertModerators?.('event', eventId);
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
        el('p', { class: 'fm-muted', text: 'Create a full event page, from a community meetup to a side event at an international conference. Fields marked optional can be added later.' }),
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

  async function renderUpcoming() {
    const box = $('[data-fm-upcoming]');
    if (!box) return;
    if (!state.me) { box.hidden = true; return; }
    const { data } = await db.from('forum_events').select(COLS).eq('status', 'published').gte('ends_at', new Date().toISOString()).order('starts_at').limit(3);
    box.replaceChildren(el('h2', { class: 'fm-side-title', text: '📅 Upcoming events' }));
    if (!data?.length) box.append(el('p', { class: 'fm-muted', text: 'No upcoming events yet.' }));
    (data || []).forEach((e) => box.append(el('a', { class: 'fm-up-row', href: `#events/${e.id}` }, [
      dateBadge(e),
      el('span', {}, [el('strong', { text: e.title }), el('small', { text: `${CATS[e.category] || ''} · ${FORMATS[e.format].split(' (')[0]}` })])
    ])));
    box.append(el('div', { class: 'fm-actions' }, [
      el('a', { class: 'fm-link', href: '#events', text: 'All events →' }),
      el('a', { class: 'fm-link', href: '#events/new', text: 'Host an event' })
    ]));
    box.hidden = false;
  }
  F.hooks.refresh.push(renderUpcoming);
})();
