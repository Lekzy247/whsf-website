// WHSF Forum moderator centre (#admin, WHSF moderators only). Overview (statistics + queue), Reports,
// Programme registrations, Members (search, suspend, restore) and the Audit log. Every rule is enforced by the
// database (forum_admin_* functions and RLS); this page only shows what the signed-in moderator may see.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  const TABS = [['overview', 'Overview'], ['reports', 'Reports'], ['orgs', 'Organisations'], ['registrations', 'Registrations'], ['members', 'Members'], ['audit', 'Audit log']];
  const PROGRAMMES = { digital_skills: 'Digital Skills', girls_in_ict: 'Girls in ICT', robotics_drones: 'Robotics & Drones', mil_lab: 'MIL Lab' };
  const ROLES = { participant: 'Participant (18+)', parent_guardian: 'Parent / guardian', teacher_school: 'Teacher / school', partner_org: 'Partner organisation', volunteer_mentor: 'Volunteer / mentor' };
  const ACTIONS = {
    'post.hide': 'hid a post', 'post.unhide': 'unhid a post', 'post.delete': 'deleted a post', 'post.pin': 'pinned a post', 'post.unpin': 'unpinned a post',
    'post.feature': 'featured a post', 'post.unfeature': 'unfeatured a post', 'member.suspend': 'suspended a member', 'member.restore': 'restored a member',
    'member.verification_approved': 'approved an ID check', 'member.verification_rejected': 'rejected an ID check', 'report.resolve': 'resolved a report',
    'report.reopen': 'reopened a report', 'space.moderator_add': 'added a space moderator', 'space.moderator_remove': 'removed a space moderator',
    'space.resource_add': 'added a space resource', 'space.resource_remove': 'removed a space resource',
    'organisation.verified': 'verified an organisation', 'organisation.rejected': 'did not verify an organisation', 'organisation.suspended': 'suspended an organisation',
    'member.factchecker_add': 'appointed a fact-checker', 'member.factchecker_remove': 'removed a fact-checker'
  };
  const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const root = () => $('[data-fm-admin]');
  const actionText = (a) => ACTIONS[a] || a.replace(/[._]/g, ' ');

  function shell(tab) {
    return el('div', { class: 'fm-admin' }, [
      el('div', { class: 'fm-fund-head' }, [el('div', {}, [el('h2', { text: 'Moderator centre' }), el('p', { class: 'fm-muted', text: 'Keep the WHSF Forum safe and useful. Every moderator action is recorded in the audit log.' })])]),
      el('nav', { class: 'fm-admin-tabs', 'aria-label': 'Moderator centre sections' }, TABS.map(([k, t]) => {
        const a = el('a', { href: `#admin/${k}`, class: `fm-admin-tab${k === tab ? ' is-on' : ''}`, text: t });
        if (k === tab) a.setAttribute('aria-current', 'page');
        return a;
      })),
      el('div', { class: 'fm-admin-body', 'data-fm-admin-body': '' }, [el('p', { class: 'fm-muted', text: 'Loading…' })])
    ]);
  }

  async function render() {
    const box = root();
    if (!box) return;
    if (!state.isStaff) { box.replaceChildren(el('p', { class: 'fm-muted', text: 'The moderator centre is for WHSF moderators only.' })); return; }
    const tab = ((location.hash || '').split('/')[1]) || 'overview';
    box.replaceChildren(shell(tab));
    const body = box.querySelector('[data-fm-admin-body]');
    try {
      if (tab === 'reports') await reports(body);
      else if (tab === 'orgs') await orgs(body);
      else if (tab === 'registrations') await registrations(body);
      else if (tab === 'members') await members(body);
      else if (tab === 'audit') await audit(body);
      else await overview(body);
    } catch (err) {
      body.replaceChildren(el('p', { class: 'fm-muted', text: `Could not load: ${err.message || err}` }));
    }
  }

  // ---------------------------------------------------------------- overview
  async function overview(body) {
    const { data: s, error } = await db.rpc('forum_admin_stats');
    if (error) throw error;
    const tile = (n, label, sub) => el('div', { class: 'fm-stat' }, [el('b', { text: String(n ?? 0) }), el('span', { text: label }), sub ? el('small', { text: sub }) : null]);
    const queue = (n, label, href) => el('a', { class: `fm-queue${n ? ' has-items' : ''}`, href }, [el('b', { text: String(n || 0) }), el('span', { text: label })]);
    const days = s.posts_daily_14d || [];
    const max = Math.max(1, ...days.map((d) => d.posts));
    const spaces = Object.entries(s.posts_by_space_30d || {}).sort((a, b) => b[1] - a[1]);
    const spaceName = (k) => (F.SPACES.find((x) => x.key === k)?.name) || (k === 'general' ? 'General' : k);
    body.replaceChildren(
      el('h3', { class: 'fm-admin-h', text: 'Needs attention' }),
      el('div', { class: 'fm-queues' }, [
        queue(s.reports_open, 'Open reports', '#admin/reports'),
        queue(s.id_checks_pending, 'ID checks waiting', '#idchecks'),
        queue(s.events_pending, 'Events to review', '#events'),
        queue(s.ads_pending, 'Adverts to review', '#ads'),
        queue(s.registrations_new, 'New programme registrations', '#admin/registrations'),
        queue(s.orgs_pending, 'Organisations to verify', '#admin/orgs')
      ]),
      el('h3', { class: 'fm-admin-h', text: 'Community' }),
      el('div', { class: 'fm-stats' }, [
        tile(s.members_approved, 'Active members', `${s.members_total} profiles in total`),
        tile(s.members_new_7d, 'New this week', `${s.members_new_30d} in 30 days`),
        tile(s.active_7d, 'Active this week', 'posted, commented or reacted'),
        tile(s.posts_7d, 'Posts this week', `${s.posts_30d} in 30 days`),
        tile(s.comments_7d, 'Comments this week', `${s.reactions_7d} reactions`),
        tile(s.events_upcoming, 'Upcoming events', null),
        tile(s.jobs_open, 'Open jobs', `${s.applications_7d || 0} applications this week`),
        tile(s.members_pending, 'Waiting for ID check', null),
        tile(s.members_suspended, 'Suspended', null)
      ]),
      el('div', { class: 'fm-admin-cols' }, [
        el('section', { class: 'fm-admin-panel' }, [
          el('h3', { class: 'fm-admin-h', text: 'Posts per day (14 days)' }),
          el('div', { class: 'fm-bars', role: 'img', 'aria-label': `Posts per day: ${days.map((d) => d.posts).join(', ')}` }, days.map((d) => el('span', { class: 'fm-bar', title: `${new Date(`${d.day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}: ${d.posts}` }, [
            el('i', { style: `height:${Math.round((d.posts / max) * 100)}%` }),
            el('small', { text: new Date(`${d.day}T00:00:00`).getDate() })
          ])))
        ]),
        el('section', { class: 'fm-admin-panel' }, [
          el('h3', { class: 'fm-admin-h', text: 'Most active spaces (30 days)' }),
          spaces.length ? el('ol', { class: 'fm-admin-rank' }, spaces.slice(0, 6).map(([k, n]) => el('li', {}, [el('span', { text: spaceName(k) }), el('b', { text: String(n) })]))) : el('p', { class: 'fm-muted', text: 'No posts yet.' }),
          el('h3', { class: 'fm-admin-h', text: 'Programme registrations' }),
          Object.keys(s.registrations_by_programme || {}).length
            ? el('ol', { class: 'fm-admin-rank' }, Object.entries(s.registrations_by_programme).map(([k, n]) => el('li', {}, [el('span', { text: PROGRAMMES[k] || k }), el('b', { text: String(n) })])))
            : el('p', { class: 'fm-muted', text: 'None yet.' })
        ])
      ])
    );
  }

  // ---------------------------------------------------------------- reports
  async function reports(body, showResolved = false) {
    const { data, error } = await db.rpc('forum_admin_reports', { p_resolved: showResolved });
    if (error) throw error;
    const toggle = el('button', { type: 'button', class: 'fm-chip-btn', text: showResolved ? 'Show open reports' : 'Show resolved reports', onclick: () => reports(body, !showResolved) });
    const list = el('div', { class: 'fm-admin-list' });
    (data || []).forEach((r) => {
      const status = el('p', { class: 'fm-status', role: 'status' });
      const resolve = async () => {
        const { error: e } = await db.from('forum_reports').update({ resolved: true }).in('id', r.report_ids);
        return e;
      };
      const actions = showResolved ? [] : [
        el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: r.is_hidden ? 'Keep hidden and close' : 'Hide post and close', onclick: async (ev) => {
          const btn = ev.currentTarget; btn.disabled = true;
          const reason = `Hidden after ${r.reports} report${r.reports === 1 ? '' : 's'}: ${(r.reasons || [])[0] || 'community rules'}`.slice(0, 300);
          const { error: e1 } = r.is_hidden ? { error: null } : await db.from('forum_posts').update({ is_hidden: true, hidden_reason: reason }).eq('id', r.post_id);
          const e2 = e1 || await resolve();
          if (e2) { status.textContent = e2.message; btn.disabled = false; return; }
          reports(body, showResolved);
        } }),
        el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Dismiss (no action)', onclick: async () => { const e = await resolve(); if (e) status.textContent = e.message; else reports(body, showResolved); } }),
        el('button', { type: 'button', class: 'fm-text-btn', text: `Suspend ${r.author_name || 'author'}…`, onclick: () => suspendForm(card, r.author_id, r.author_name, () => reports(body, showResolved)) })
      ];
      const card = el('article', { class: 'fm-admin-card' }, [
        el('div', { class: 'fm-admin-card-head' }, [
          el('strong', { text: `${r.reports} report${r.reports === 1 ? '' : 's'}` }),
          el('small', { class: 'fm-muted', text: `Last ${when(r.last_reported_at)}${r.is_hidden ? ' · post hidden' : ''}` })
        ]),
        el('blockquote', { class: 'fm-admin-quote', text: F.plainText(r.body).slice(0, 400) }),
        el('p', { class: 'fm-small' }, [el('span', { class: 'fm-muted', text: 'By ' }), el('strong', { text: r.author_name || 'Member' }), ' · ', el('a', { href: `#post/${r.post_id}`, text: 'Open post' })]),
        el('ul', { class: 'fm-admin-reasons' }, (r.reasons || []).slice(0, 5).map((x) => el('li', { text: x || '(no reason given)' }))),
        el('div', { class: 'fm-actions' }, actions),
        status
      ]);
      list.append(card);
    });
    body.replaceChildren(
      el('div', { class: 'fm-admin-bar' }, [el('h3', { class: 'fm-admin-h', text: showResolved ? 'Resolved reports' : 'Open reports' }), toggle]),
      data?.length ? list : el('p', { class: 'fm-empty', text: showResolved ? 'No resolved reports.' : 'No open reports. 🎉' })
    );
  }

  function suspendForm(anchor, userId, name, done) {
    if (anchor.querySelector('.fm-admin-suspend')) return;
    const reason = el('input', { maxlength: '300', placeholder: 'Reason (shown in the audit log)', 'aria-label': 'Reason for suspension' });
    const status = el('p', { class: 'fm-status', role: 'status' });
    const box = el('div', { class: 'fm-admin-suspend' }, [
      el('p', { text: `Suspend ${name || 'this member'}? They are signed out of the Forum and cannot read or post until restored.` }),
      reason,
      el('div', { class: 'fm-actions' }, [
        el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Suspend', onclick: async () => {
          const { error } = await db.rpc('forum_admin_suspend', { p_user: userId, p_on: true, p_reason: reason.value });
          if (error) { status.textContent = error.message; return; }
          done();
        } }),
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Cancel', onclick: () => box.remove() })
      ]),
      status
    ]);
    anchor.append(box);
    reason.focus();
  }

  // ---------------------------------------------------------------- organisations (employer / NGO verification)
  async function orgs(body, filter = 'pending') {
    const KINDS = { employer: 'Employer', ngo: 'NGO / nonprofit', both: 'NGO that also hires' };
    const { data, error } = await db.from('forum_orgs').select('id,owner_id,name,kind,website,country,sector,about,status,review_note,created_at').eq('status', filter).order('created_at', { ascending: filter === 'pending' }).limit(100);
    if (error) throw error;
    const ids = (data || []).map((o) => o.id);
    const owners = [...new Set((data || []).map((o) => o.owner_id))];
    const [{ data: priv }, { data: profs }] = await Promise.all([
      ids.length ? db.from('forum_org_private').select('org_id,registration_number,tax_id,certificate_path,contact_email').in('org_id', ids) : { data: [] },
      owners.length ? db.from('forum_profiles').select('user_id,display_name').in('user_id', owners) : { data: [] }
    ]);
    const pm = new Map((priv || []).map((p) => [p.org_id, p]));
    const om = new Map((profs || []).map((p) => [p.user_id, p.display_name]));
    const filters = el('div', { class: 'fm-chips' }, [['pending', 'Waiting'], ['verified', 'Verified'], ['rejected', 'Not verified'], ['suspended', 'Suspended']].map(([k, t]) => el('button', {
      type: 'button', class: `fm-chip-btn${k === filter ? ' is-on' : ''}`, text: t, onclick: () => orgs(body, k)
    })));
    const list = el('div', { class: 'fm-admin-list' }, (data || []).map((o) => {
      const p = pm.get(o.id) || {};
      const msg = el('p', { class: 'fm-status', role: 'status' });
      const note = el('input', { maxlength: '500', placeholder: 'Note to the organisation (required to reject)', 'aria-label': 'Review note' });
      const decide = async (approve) => {
        const { error: e } = await db.rpc('forum_org_review', { p_org: o.id, p_approve: approve, p_note: note.value });
        if (e) msg.textContent = e.message; else orgs(body, filter);
      };
      return el('article', { class: 'fm-admin-card' }, [
        el('div', { class: 'fm-admin-card-head' }, [el('strong', { text: o.name }), el('small', { class: 'fm-muted', text: `${KINDS[o.kind]} · submitted ${when(o.created_at)}` })]),
        el('p', { class: 'fm-small' }, [el('a', { href: o.website, target: '_blank', rel: 'noopener noreferrer', text: `${o.website} ↗` }), ` · ${o.country}${o.sector ? ` · ${o.sector}` : ''}`]),
        el('p', { class: 'fm-small' }, ['Registered by ', el('a', { href: `#profile/${o.owner_id}`, text: om.get(o.owner_id) || 'member' }), p.contact_email ? ` · ${p.contact_email}` : '']),
        el('dl', { class: 'fm-org-check' }, [
          el('dt', { text: 'Registration no.' }), el('dd', { text: p.registration_number || '—' }),
          el('dt', { text: 'Tax ID / EIN' }), el('dd', { text: p.tax_id || '—' })
        ]),
        o.about ? el('blockquote', { class: 'fm-admin-quote', text: o.about }) : null,
        o.review_note ? el('p', { class: 'fm-small fm-muted', text: `Note: ${o.review_note}` }) : null,
        el('p', { class: 'fm-small fm-muted', text: 'Check: the certificate matches the name and number, the website is real and belongs to them, and the tax ID matches the registry.' }),
        el('div', { class: 'fm-admin-row' }, [
          p.certificate_path ? el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: '📄 Open certificate', onclick: async () => {
            const { data: u } = await db.storage.from('forum-org-docs').createSignedUrl(p.certificate_path, 300);
            if (u?.signedUrl) window.open(u.signedUrl, '_blank', 'noopener'); else msg.textContent = 'The certificate could not be opened.';
          } }) : el('span', { class: 'fm-small', text: 'No certificate uploaded' }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Message', onclick: () => F.startMessage?.(o.owner_id) })
        ]),
        filter === 'verified'
          ? el('div', { class: 'fm-actions' }, [el('button', { type: 'button', class: 'fm-text-btn', text: 'Suspend organisation', onclick: async () => {
            const { error: e } = await db.from('forum_orgs').update({ status: 'suspended', review_note: 'Suspended by WHSF' }).eq('id', o.id);
            if (e) msg.textContent = e.message; else orgs(body, filter);
          } })])
          : el('div', { class: 'fm-admin-row' }, [note,
            el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: '✔ Verify', onclick: () => decide(true) }),
            el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Not verified', onclick: () => decide(false) })]),
        msg
      ].filter(Boolean));
    }));
    body.replaceChildren(
      el('h3', { class: 'fm-admin-h', text: 'Organisations' }),
      el('p', { class: 'fm-small fm-muted', text: 'Employers and NGOs are verified by their registration certificate, official website and Tax ID / EIN before they can post jobs.' }),
      filters,
      data?.length ? list : el('p', { class: 'fm-empty', text: 'Nothing here.' })
    );
  }

  // ---------------------------------------------------------------- programme registrations
  async function registrations(body, filter = 'new') {
    let q = db.from('whsf_programme_registrations').select('id,reference,programme,role,full_name,email,country,organisation,message,status,created_at').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data, error } = await q;
    if (error) throw error;
    const filters = el('div', { class: 'fm-chips' }, [['new', 'New'], ['contacted', 'Contacted'], ['enrolled', 'Enrolled'], ['closed', 'Closed'], ['all', 'All']].map(([k, t]) => el('button', {
      type: 'button', class: `fm-chip-btn${k === filter ? ' is-on' : ''}`, text: t, onclick: () => registrations(body, k)
    })));
    const csv = el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Download CSV', onclick: () => {
      const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
      const head = ['Reference', 'Programme', 'Registering as', 'Name', 'Email', 'Country', 'Organisation', 'Message', 'Status', 'Registered'];
      const rows = (data || []).map((r) => [r.reference, PROGRAMMES[r.programme], ROLES[r.role], r.full_name, r.email, r.country, r.organisation, r.message, r.status, r.created_at].map(cell).join(','));
      const a = el('a', { href: URL.createObjectURL(new Blob([[head.map(cell).join(','), ...rows].join('\r\n')], { type: 'text/csv' })), download: `whsf-programme-registrations-${filter}.csv` });
      document.body.append(a); a.click(); a.remove();
    } });
    const list = el('div', { class: 'fm-admin-list' }, (data || []).map((r) => {
      const sel = el('select', { 'aria-label': `Status for ${r.reference}` }, [['new', 'New'], ['contacted', 'Contacted'], ['enrolled', 'Enrolled'], ['closed', 'Closed']].map(([v, t]) => el('option', { value: v, text: t })));
      sel.value = r.status;
      const status = el('small', { class: 'fm-muted', role: 'status' });
      sel.addEventListener('change', async () => {
        const { error: e } = await db.from('whsf_programme_registrations').update({ status: sel.value }).eq('id', r.id);
        status.textContent = e ? e.message : 'Saved.';
      });
      return el('article', { class: 'fm-admin-card' }, [
        el('div', { class: 'fm-admin-card-head' }, [el('strong', { text: `${PROGRAMMES[r.programme] || r.programme} · ${r.full_name}` }), el('small', { class: 'fm-muted', text: `${r.reference} · ${when(r.created_at)}` })]),
        el('p', { class: 'fm-small', text: `${ROLES[r.role] || r.role} · ${r.country}${r.organisation ? ` · ${r.organisation}` : ''}` }),
        el('p', { class: 'fm-small' }, [el('a', { href: `mailto:${r.email}?subject=${encodeURIComponent(`WHSF ${PROGRAMMES[r.programme] || ''} [${r.reference}]`)}`, text: r.email })]),
        r.message ? el('blockquote', { class: 'fm-admin-quote', text: r.message }) : null,
        el('div', { class: 'fm-admin-row' }, [el('label', { class: 'fm-inline-label' }, ['Status ', sel]), status])
      ]);
    }));
    body.replaceChildren(
      el('div', { class: 'fm-admin-bar' }, [el('h3', { class: 'fm-admin-h', text: 'Programme registrations' }), csv]),
      filters,
      data?.length ? list : el('p', { class: 'fm-empty', text: 'No registrations here.' })
    );
  }

  // ---------------------------------------------------------------- members
  async function members(body, q = '', filter = 'all') {
    const search = el('input', { type: 'search', placeholder: 'Search by name or email', 'aria-label': 'Search members', value: q, maxlength: '80' });
    const filters = el('div', { class: 'fm-chips' }, [['all', 'All'], ['approved', 'Active'], ['pending', 'Waiting for ID check'], ['suspended', 'Suspended']].map(([k, t]) => el('button', {
      type: 'button', class: `fm-chip-btn${k === filter ? ' is-on' : ''}`, text: t, onclick: () => members(body, search.value.trim(), k)
    })));
    const list = el('div', { class: 'fm-admin-list' }, [el('p', { class: 'fm-muted', text: 'Loading…' })]);
    body.replaceChildren(el('h3', { class: 'fm-admin-h', text: 'Members' }), search, filters, list);
    let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => members(body, search.value.trim(), filter).then(() => { const s = body.querySelector('input[type=search]'); s.focus(); s.setSelectionRange(s.value.length, s.value.length); }), 400); });
    const { data, error } = await db.rpc('forum_admin_members', { p_q: q || null, p_filter: filter, p_limit: 50, p_offset: 0 });
    if (error) throw error;
    list.replaceChildren(...(data?.length ? data.map((m) => {
      const card = el('article', { class: `fm-admin-card${m.is_suspended ? ' is-suspended' : ''}` });
      const status = el('p', { class: 'fm-status', role: 'status' });
      const badge = m.is_suspended ? 'Suspended' : m.verification_status === 'approved' ? 'Active' : m.verification_status === 'pending' ? 'Waiting for ID check' : m.verification_status === 'rejected' ? 'ID not accepted' : 'Not verified';
      card.append(...[
        el('div', { class: 'fm-admin-card-head' }, [el('strong', { text: m.display_name }), el('span', { class: `fm-admin-badge is-${m.is_suspended ? 'suspended' : m.verification_status}`, text: badge })]),
        el('p', { class: 'fm-small', text: [m.headline, m.location].filter(Boolean).join(' · ') || ' ' }),
        el('p', { class: 'fm-small fm-muted', text: `${m.email} · joined ${when(m.created_at)} · last sign-in ${when(m.last_sign_in_at)} · ${m.posts} post${m.posts === 1 ? '' : 's'}` }),
        m.is_suspended ? el('p', { class: 'fm-small', text: `Suspended ${when(m.suspended_at)}: ${m.suspended_reason || ''}` }) : null,
        el('div', { class: 'fm-actions' }, [
          m.is_suspended
            ? el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: 'Restore member', onclick: async () => {
              const { error: e } = await db.rpc('forum_admin_suspend', { p_user: m.user_id, p_on: false });
              if (e) status.textContent = e.message; else members(body, q, filter);
            } })
            : m.user_id === state.me?.user_id ? el('small', { class: 'fm-muted', text: 'This is you' })
              : el('button', { type: 'button', class: 'fm-text-btn', text: 'Suspend…', onclick: () => suspendForm(card, m.user_id, m.display_name, () => members(body, q, filter)) }),
          el('button', { type: 'button', class: 'fm-text-btn', text: 'Message', onclick: () => F.startMessage?.(m.user_id) })
        ]),
        status
      ].filter(Boolean));
      return card;
    }) : [el('p', { class: 'fm-empty', text: 'No members found.' })]));
  }

  // ---------------------------------------------------------------- audit log
  async function audit(body, before = null) {
    let q = db.from('forum_audit_log').select('id,actor_id,action,target_type,target_id,detail,created_at').order('id', { ascending: false }).limit(50);
    if (before) q = q.lt('id', before);
    const { data, error } = await q;
    if (error) throw error;
    const ids = [...new Set((data || []).map((r) => r.actor_id).filter(Boolean))];
    const { data: profs } = ids.length ? await db.from('forum_profiles').select('user_id,display_name').in('user_id', ids) : { data: [] };
    const names = new Map((profs || []).map((p) => [p.user_id, p.display_name]));
    const rows = (data || []).map((r) => {
      const d = r.detail || {};
      const what = d.excerpt || d.name || d.title || d.url || d.reference || '';
      const link = r.target_type === 'post' ? `#post/${r.target_id}` : r.target_type === 'event' ? `#events/${r.target_id}` : r.target_type === 'space' ? `#space/${r.target_id}` : null;
      return el('li', {}, [
        el('time', { datetime: r.created_at, text: when(r.created_at) }),
        el('span', {}, [
          el('strong', { text: names.get(r.actor_id) || (r.actor_id ? 'A moderator' : 'System') }), ` ${actionText(r.action)}`,
          what ? el('span', { class: 'fm-muted', text: `: “${String(what).slice(0, 90)}”` }) : null,
          d.reason ? el('span', { class: 'fm-muted', text: ` (reason: ${String(d.reason).slice(0, 120)})` }) : null,
          link ? el('a', { class: 'fm-audit-link', href: link, text: ' Open' }) : null
        ])
      ]);
    });
    const list = before ? body.querySelector('.fm-audit') : el('ol', { class: 'fm-audit' });
    list.append(...rows);
    body.querySelector('.fm-more')?.remove();
    if (!before) body.replaceChildren(el('h3', { class: 'fm-admin-h', text: 'Audit log' }), el('p', { class: 'fm-small fm-muted', text: 'Recorded automatically by the database. Entries cannot be edited or deleted.' }), data?.length ? list : el('p', { class: 'fm-empty', text: 'No moderator actions yet.' }));
    if (data?.length === 50) body.append(el('button', { class: 'fm-more', type: 'button', text: 'Show older', onclick: () => audit(body, data[data.length - 1].id) }));
  }

  F.hooks.view.push((view) => { if (view === 'admin') render(); });
})();
