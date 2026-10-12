// WHSF Forum add-on: member adverts ("Advertise on WHSF", reviewed by WHSF) and invite links.
// Access rules live in the database (supabase/migrations/20261012_forum_ads_invites.sql).
// Routes: #ads, #ads/new, #ads/edit/<id>, #invite. Member text is inserted with textContent only.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  const IMAGE_PREFIX = 'https://ophymlgqnfilgxsuzcuz.supabase.co/storage/v1/object/public/forum-images/';
  const REF_KEY = 'whsf-forum-ref';
  const STATUS = { pending: 'Waiting for WHSF approval', live: 'Live', paused: 'Paused', rejected: 'Not approved', ended: 'Ended' };
  const safeImg = (u) => (typeof u === 'string' && u.startsWith(IMAGE_PREFIX) ? u : null);
  const safeLink = (u) => (typeof u === 'string' && /^https:\/\/\S+$/.test(u) ? u : null);
  const store = {
    get: () => { try { return localStorage.getItem(REF_KEY); } catch { return null; } },
    set: (v) => { try { localStorage.setItem(REF_KEY, v); } catch { /* storage blocked */ } },
    clear: () => { try { localStorage.removeItem(REF_KEY); } catch { /* storage blocked */ } }
  };

  // Remember an invite code from ?ref= until the visitor has created their forum profile.
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && /^[a-z0-9]{6,12}$/i.test(ref)) store.set(ref.toLowerCase());

  // ---------------------------------------------------------------- "Sponsored" slot
  const seen = new Set();
  async function renderSponsored() {
    const slot = $('[data-fm-sponsored]');
    if (!slot) return;
    if (!state.me) { slot.hidden = true; return; }
    const { data } = await db.rpc('forum_ads_now', { p_limit: 1 });
    const ad = (data || [])[0];
    const link = ad && safeLink(ad.link_url);
    if (!ad || !link) { slot.hidden = true; return; }
    const img = safeImg(ad.image_url);
    slot.replaceChildren(
      el('span', { class: 'fm-badge', text: 'Sponsored' }),
      img ? el('img', { src: img, alt: '', loading: 'lazy' }) : null,
      el('h2', { text: ad.headline }),
      el('p', { text: ad.body }),
      el('a', { class: 'hp-btn hp-btn-primary', href: link, target: '_blank', rel: 'noopener noreferrer sponsored', text: ad.cta, onclick: () => db.rpc('forum_ad_event', { p_ad: ad.id, p_kind: 'click' }) }),
      el('a', { class: 'fm-link', href: '#ads', text: 'Advertise on WHSF' })
    );
    slot.hidden = false;
    if (!seen.has(ad.id)) { seen.add(ad.id); db.rpc('forum_ad_event', { p_ad: ad.id, p_kind: 'view' }); }
  }

  // ---------------------------------------------------------------- #ads
  const root = () => $('[data-fm-ads]');
  const back = () => el('a', { class: 'fm-text-btn', href: '#ads', text: '← Your adverts' });

  function preview(a) {
    const img = safeImg(a.image_url);
    return el('div', { class: 'fm-ad-preview' }, [
      el('span', { class: 'fm-badge', text: 'Sponsored' }),
      img ? el('img', { src: img, alt: '' }) : null,
      el('strong', { text: a.headline || 'Your headline' }),
      el('p', { text: a.body || 'Your advert text' }),
      el('span', { class: 'hp-btn hp-btn-primary', text: a.cta || 'Learn more' })
    ]);
  }

  async function renderList() {
    const box = root();
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading your adverts…' }));
    const [{ data: mine }, staffQ] = await Promise.all([
      db.from('forum_ads').select('*').eq('owner_id', state.me.user_id).order('created_at', { ascending: false }),
      state.isStaff ? db.from('forum_ads').select('*').eq('status', 'pending').order('created_at') : Promise.resolve({ data: [] })
    ]);
    box.replaceChildren(el('div', { class: 'fm-ev-head' }, [
      el('div', {}, [
        el('h2', { text: 'Advertise on WHSF' }),
        el('p', { class: 'fm-muted', text: 'Promote a programme, course, event, job or service to verified WHSF Forum members. Adverts are free for now and run for 30 days. WHSF checks every advert before it goes live.' })
      ]),
      el('a', { class: 'hp-btn hp-btn-primary', href: '#ads/new', text: 'Create an advert' })
    ]));
    if (state.isStaff && staffQ.data?.length) {
      box.append(el('h3', { class: 'fm-ev-section', text: `Waiting for your approval (${staffQ.data.length})` }));
      staffQ.data.forEach((a) => box.append(reviewRow(a)));
    }
    box.append(el('h3', { class: 'fm-ev-section', text: 'Your adverts' }));
    if (!mine?.length) { box.append(el('p', { class: 'fm-muted', text: 'You have no adverts yet.' })); return; }
    mine.forEach((a) => box.append(ownRow(a)));
  }

  function stats(a) {
    const ctr = a.views ? `${((a.clicks / a.views) * 100).toFixed(1)}%` : '–';
    return el('div', { class: 'fm-ad-stats' }, [
      el('span', {}, [el('b', { text: String(a.views) }), el('small', { text: 'views' })]),
      el('span', {}, [el('b', { text: String(a.clicks) }), el('small', { text: 'clicks' })]),
      el('span', {}, [el('b', { text: ctr }), el('small', { text: 'click rate' })])
    ]);
  }

  function ownRow(a) {
    const status = el('p', { class: 'fm-status', role: 'status' });
    const setStatus = async (next) => {
      const { error } = await db.from('forum_ads').update({ status: next }).eq('id', a.id);
      if (error) status.textContent = error.message; else renderList();
    };
    const actions = el('div', { class: 'fm-actions' }, [
      el('a', { class: 'hp-btn hp-btn-outline', href: `#ads/edit/${a.id}`, text: 'Edit' }),
      a.status === 'live' ? el('button', { class: 'fm-text-btn', type: 'button', text: 'Pause', onclick: () => setStatus('paused') }) : null,
      a.status === 'paused' ? el('button', { class: 'fm-text-btn', type: 'button', text: 'Resume', onclick: () => setStatus('live') }) : null,
      el('button', { class: 'fm-text-btn', type: 'button', text: 'Delete', onclick: () => {
        const ask = el('div', { class: 'fm-confirm' }, [
          el('p', { text: 'Delete this advert? This cannot be undone.' }),
          el('div', { class: 'fm-actions' }, [
            el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Delete', onclick: async () => {
              const { error } = await db.from('forum_ads').delete().eq('id', a.id);
              if (error) status.textContent = error.message; else renderList();
            } }),
            el('button', { class: 'fm-text-btn', type: 'button', text: 'Keep it', onclick: () => ask.remove() })
          ])
        ]);
        actions.after(ask);
      } })
    ]);
    const ends = a.status === 'live' ? `Runs until ${new Date(a.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '';
    return el('article', { class: 'fm-ad-row' }, [
      preview(a),
      el('div', { class: 'fm-ad-side' }, [
        el('span', { class: `fm-chip is-${a.status}`, text: STATUS[a.status] || a.status }),
        a.review_note ? el('p', { class: 'fm-muted', text: `WHSF note: ${a.review_note}` }) : null,
        ends ? el('p', { class: 'fm-muted', text: ends }) : null,
        stats(a), actions, status
      ])
    ]);
  }

  function reviewRow(a) {
    const status = el('p', { class: 'fm-status', role: 'status' });
    const note = el('input', { type: 'text', maxlength: '300', placeholder: 'Reason if rejecting (sent to the advertiser)' });
    const decide = async (approve) => {
      const { error } = await db.rpc('forum_ad_review', { p_ad: a.id, p_approve: approve, p_note: note.value });
      if (error) status.textContent = error.message; else renderList();
    };
    return el('article', { class: 'fm-ad-row' }, [
      preview(a),
      el('div', { class: 'fm-ad-side' }, [
        el('p', { class: 'fm-muted', text: 'Approve only honest adverts: no requests for money or bank details, no "grants" or prizes that need a fee, no adult or political content.' }),
        el('p', {}, [document.createTextNode('Link: '), el('a', { href: safeLink(a.link_url) || '#', target: '_blank', rel: 'noopener noreferrer', text: a.link_url })]),
        el('div', { class: 'fm-form' }, [el('label', {}, [document.createTextNode('Reason if rejecting'), note])]),
        el('div', { class: 'fm-actions' }, [
          el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Approve', onclick: () => decide(true) }),
          el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Reject', onclick: () => decide(false) })
        ]),
        status
      ])
    ]);
  }

  async function renderForm(id) {
    const box = root();
    let a = null;
    if (id) {
      const { data } = await db.from('forum_ads').select('*').eq('id', id).eq('owner_id', state.me.user_id).maybeSingle();
      if (!data) { box.replaceChildren(back(), el('p', { text: 'You can only edit your own adverts.' })); return; }
      a = data;
    }
    const field = (label, input, hint) => el('label', {}, [document.createTextNode(label), hint ? el('small', { text: ` ${hint}` }) : null, input]);
    const headline = el('input', { name: 'headline', maxlength: '80', placeholder: 'e.g. Free coding classes for adults' });
    const body = el('textarea', { name: 'body', rows: '3', maxlength: '200', placeholder: 'What makes it worth a click? (up to 200 characters)' });
    const link = el('input', { name: 'link', type: 'url', maxlength: '500', placeholder: 'https://' });
    const cta = el('input', { name: 'cta', maxlength: '24', placeholder: 'Learn more' });
    const image = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp' });
    const status = el('p', { class: 'fm-status', role: 'status' });
    const live = el('div', { class: 'fm-ad-live' });
    const draw = () => live.replaceChildren(el('p', { class: 'fm-small fm-muted', text: 'Preview' }), preview({ headline: headline.value, body: body.value, cta: cta.value, image_url: a?.image_url }));
    [headline, body, cta].forEach((i) => i.addEventListener('input', draw));
    if (a) { headline.value = a.headline; body.value = a.body; link.value = a.link_url; cta.value = a.cta; }
    draw();
    const form = el('form', { class: 'fm-form', novalidate: '' }, [
      field('Headline', headline),
      field('Advert text', body),
      field('Link', link, '(must start with https://)'),
      field('Button text', cta, '(optional)'),
      field('Picture', image, '(optional, JPG/PNG/WebP up to 5 MB)'),
      el('p', { class: 'fm-small fm-muted', text: a ? 'Changing an advert sends it back to WHSF for review.' : 'WHSF reviews every advert before it goes live, usually within 2 working days.' }),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: a ? 'Save and resubmit' : 'Submit for approval' }),
        el('a', { class: 'fm-text-btn', href: '#ads', text: 'Cancel' })
      ]),
      status
    ]);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const say = (t) => { status.textContent = t; };
      if (headline.value.trim().length < 3) return say('Add a headline.');
      if (body.value.trim().length < 10) return say('Add a little more advert text (at least 10 characters).');
      if (!/^https:\/\/\S+$/.test(link.value.trim())) return say('The link must start with https://');
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      let imageUrl = a?.image_url || null;
      const file = image.files[0];
      if (file) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { button.disabled = false; return say('The picture must be JPG, PNG or WebP up to 5 MB.'); }
        const path = `${state.me.user_id}/${crypto.randomUUID()}.${file.type.split('/')[1].replace('jpeg', 'jpg')}`;
        const { error } = await db.storage.from('forum-images').upload(path, file, { contentType: file.type, upsert: false });
        if (error) { button.disabled = false; return say('Picture upload failed. Please try again.'); }
        imageUrl = `${IMAGE_PREFIX}${path}`;
      }
      const row = { headline: headline.value.trim(), body: body.value.trim(), link_url: link.value.trim(), cta: cta.value.trim() || 'Learn more', image_url: imageUrl };
      const { error } = a
        ? await db.from('forum_ads').update(row).eq('id', a.id)
        : await db.from('forum_ads').insert({ ...row, owner_id: state.me.user_id });
      button.disabled = false;
      if (error) return say(error.message);
      location.hash = '#ads';
    });
    box.replaceChildren(back(), el('div', { class: 'fm-ad-editor' }, [
      el('div', {}, [el('h2', { text: a ? 'Edit advert' : 'Create an advert' }), form]),
      live
    ]));
  }

  // ---------------------------------------------------------------- #invite
  async function renderInvite() {
    const box = $('[data-fm-invite]');
    box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading your invite link…' }));
    const [{ data: code, error }, { data: stats }] = await Promise.all([db.rpc('forum_my_invite'), db.rpc('forum_invite_stats')]);
    if (error) { box.replaceChildren(el('p', { text: error.message })); return; }
    const url = `${location.origin}/forum.html?join=1&ref=${code}`;
    const row = Array.isArray(stats) ? stats[0] : stats;
    const status = el('p', { class: 'fm-status', role: 'status' });
    const text = encodeURIComponent(`Join me on the WHSF Forum, a verified community for people building opportunity through technology: ${url}`);
    box.replaceChildren(
      el('h2', { text: 'Invite members' }),
      el('p', { class: 'fm-muted', text: 'Share your personal link with people who would value the WHSF Forum: learners, mentors, volunteers, partners and families. Please only send it to people you know. Everyone still needs to pass WHSF’s 18+ ID check.' }),
      el('div', { class: 'fm-invite-link' }, [
        el('input', { type: 'text', readonly: '', value: url, 'aria-label': 'Your invite link', onclick: (ev) => ev.currentTarget.select() }),
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Copy link', onclick: async () => {
          try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied.'; } catch { status.textContent = 'Select the link and copy it.'; }
        } })
      ]),
      status,
      el('div', { class: 'fm-actions' }, [
        el('a', { class: 'hp-btn hp-btn-outline', href: `https://wa.me/?text=${text}`, target: '_blank', rel: 'noopener noreferrer', text: 'Share on WhatsApp' }),
        el('a', { class: 'hp-btn hp-btn-outline', href: `mailto:?subject=${encodeURIComponent('Join me on the WHSF Forum')}&body=${text}`, text: 'Share by email' })
      ]),
      el('div', { class: 'fm-ad-stats fm-invite-stats' }, [
        el('span', {}, [el('b', { text: String(row?.joined || 0) }), el('small', { text: 'joined with your link' })]),
        el('span', {}, [el('b', { text: String(row?.verified || 0) }), el('small', { text: 'verified members' })])
      ])
    );
  }

  // ---------------------------------------------------------------- wiring
  F.hooks.refresh.push(async () => {
    renderSponsored();
    const code = store.get();
    if (code && state.profile) {
      await db.rpc('forum_record_invite', { p_code: code });
      store.clear();
    }
  });
  F.hooks.view.push((view) => {
    if (!state.me) return;
    const parts = (location.hash || '').slice(1).split('/');
    if (view === 'ads') {
      if (parts[1] === 'new') renderForm(null);
      else if (parts[1] === 'edit' && /^[0-9a-f-]{36}$/.test(parts[2] || '')) renderForm(parts[2]);
      else renderList();
    }
    if (view === 'invite') renderInvite();
  });
})();
