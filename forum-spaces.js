// WHSF Forum add-on: space pages (#space/<key>) and the spaces directory (#spaces).
// Each space: description, Join/Leave, member count and faces, moderators (appointed by WHSF), featured
// discussions, resources and upcoming events, above the space's own feed.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar } = F;
  const KINDS = { guide: 'Guide', toolkit: 'Toolkit', course: 'Course', website: 'Website', template: 'Template', report: 'Report', portal: 'Portal' };
  const my = { spaces: new Set(), modOf: new Set(), loaded: false };
  let counts = new Map();

  async function loadMine() {
    if (!state.me) { my.spaces = new Set(); my.modOf = new Set(); return; }
    const [{ data: s }, { data: m }, { data: c }] = await Promise.all([
      db.from('forum_space_members').select('space').eq('user_id', state.me.user_id),
      db.from('forum_space_moderators').select('space').eq('user_id', state.me.user_id),
      db.rpc('forum_space_counts')
    ]);
    my.spaces = new Set((s || []).map((x) => x.space));
    my.modOf = new Set((m || []).map((x) => x.space));
    counts = new Map((c || []).map((x) => [x.space, Number(x.members)]));
    my.loaded = true;
  }
  const isMod = (space) => state.isStaff || my.modOf.has(space);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  async function setJoined(space, on) {
    const res = on
      ? await db.from('forum_space_members').insert({ user_id: state.me.user_id, space })
      : await db.from('forum_space_members').delete().eq('user_id', state.me.user_id).eq('space', space);
    if (res.error) return false;
    if (on) my.spaces.add(space); else my.spaces.delete(space);
    counts.set(space, Math.max(0, (counts.get(space) || 0) + (on ? 1 : -1)));
    return true;
  }
  function joinButton(space, onChange) {
    const joined = my.spaces.has(space);
    const b = el('button', { type: 'button', class: joined ? 'hp-btn hp-btn-outline' : 'hp-btn hp-btn-primary', 'aria-pressed': String(joined), text: joined ? '✓ Joined' : 'Join space' });
    b.addEventListener('click', async () => {
      b.disabled = true;
      const ok = await setJoined(space, !my.spaces.has(space));
      b.disabled = false;
      if (ok) onChange?.();
    });
    return b;
  }

  // ---------------------------------------------------------------- space page (above the space feed)
  async function renderSpace() {
    const slot = $('[data-fm-space-slot]');
    if (!slot) return;
    const hash = (location.hash || '').slice(1).split('/');
    const sp = state.topic && F.SPACES.find((s) => s.key === state.topic);
    if (!state.me || !sp || hash[0] !== 'space') { slot.replaceChildren(); return; }
    if (!my.loaded) await loadMine();
    const today = new Date().toISOString();
    const [{ data: memberRows }, { data: modRows }, { data: featured }, { data: resources }, { data: events }] = await Promise.all([
      db.from('forum_space_members').select('user_id').eq('space', sp.key).order('joined_at', { ascending: false }).limit(12),
      db.from('forum_space_moderators').select('user_id').eq('space', sp.key),
      db.from('forum_posts').select('id,body,kind,created_at,author:forum_profiles!forum_posts_author_id_fkey(display_name)').eq('topic', sp.key).not('featured_at', 'is', null).order('featured_at', { ascending: false }).limit(5),
      db.from('forum_space_resources').select('id,title,url,about,kind').eq('space', sp.key).order('created_at').limit(20),
      (sp.key === 'conferences'
        ? db.from('forum_events').select('id,title,starts_at,time_zone,format,city,country').eq('status', 'published').gte('ends_at', today)
        : db.from('forum_events').select('id,title,starts_at,time_zone,format,city,country').eq('status', 'published').eq('space', sp.key).gte('ends_at', today)
      ).order('starts_at').limit(4)
    ]);
    const ids = [...new Set([...(memberRows || []), ...(modRows || [])].map((r) => r.user_id))];
    const { data: profs } = ids.length
      ? await db.from('forum_profiles').select('user_id,display_name,avatar_url,headline').in('user_id', ids).eq('verification_status', 'approved')
      : { data: [] };
    const pmap = new Map((profs || []).map((p) => [p.user_id, p]));
    const members = (memberRows || []).filter((r) => pmap.has(r.user_id)).map((r) => ({ user_id: r.user_id, profile: pmap.get(r.user_id) }));
    const mods = (modRows || []).map((r) => ({ user_id: r.user_id, profile: pmap.get(r.user_id) }));
    const total = counts.get(sp.key) || 0;
    const rerender = () => renderSpace();

    const header = el('section', { class: 'fm-card fm-space-head' }, [
      el('div', { class: 'fm-space-title' }, [
        el('span', { class: 'fm-space-emoji', 'aria-hidden': 'true', text: sp.emoji }),
        el('div', {}, [
          el('h2', { text: sp.name }),
          el('p', { class: 'fm-muted', text: sp.about }),
          el('p', { class: 'fm-space-stats' }, [el('strong', { text: plural(total, 'member', 'members') }), ' · Open to all verified WHSF Forum members'])
        ])
      ]),
      el('div', { class: 'fm-space-faces', 'aria-label': 'Recently joined' }, (members || []).map((m) => { const a = el('span', { class: 'fm-avatar fm-avatar-sm', title: m.profile?.display_name || 'Member' }); fillAvatar(a, m.profile || {}); return a; })),
      el('div', { class: 'fm-actions' }, [
        joinButton(sp.key, rerender),
        el('button', { type: 'button', class: 'hp-btn hp-btn-outline', text: '✏️ Post in this space', onclick: () => {
          const f = $('[data-fm-post-form]'); if (!f) return;
          f.topic.value = sp.key; f.body.focus(); f.closest('section')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } }),
        el('a', { class: 'fm-text-btn', href: '#spaces', text: 'All spaces' })
      ])
    ]);

    // Moderators
    const modBox = el('div', { class: 'fm-space-mods' }, [
      el('span', { class: 'fm-muted', text: 'Moderated by ' }),
      el('strong', { text: 'WHSF' }),
      ...(mods || []).map((m) => el('span', { class: 'fm-space-mod' }, ['· ', el('strong', { text: m.profile?.display_name || 'Member' }),
        state.isStaff ? el('button', { type: 'button', class: 'fm-text-btn', 'aria-label': `Remove ${m.profile?.display_name || 'moderator'} as moderator`, text: '×', onclick: async () => {
          await db.from('forum_space_moderators').delete().eq('space', sp.key).eq('user_id', m.user_id); rerender();
        } }) : null]))
    ]);
    if (state.isStaff) modBox.append(addModerator(sp.key, rerender));
    header.append(modBox);

    // Featured discussions
    const featuredCard = el('section', { class: 'fm-card fm-space-sec' }, [
      el('h3', { text: '⭐ Featured discussions' }),
      featured?.length
        ? el('ol', { class: 'fm-space-list' }, featured.map((p) => el('li', {}, [
          el('a', { href: `#post/${p.id}`, text: F.plainText(p.body).split('\n')[0].slice(0, 110) || 'Post' }),
          el('small', { class: 'fm-muted', text: `${p.author?.display_name || 'Member'}${p.kind === 'poll' ? ' · Poll' : p.kind === 'collab' ? ' · Collaboration' : ''}` })
        ])))
        : el('p', { class: 'fm-muted fm-small', text: isMod(sp.key) ? 'Nothing featured yet. Use “Feature in this space” in a post’s ⋯ menu.' : 'Moderators will feature the best discussions here.' })
    ]);

    // Resources
    const resCard = el('section', { class: 'fm-card fm-space-sec' }, [
      el('h3', { text: '📚 Resources' }),
      resources?.length
        ? el('ul', { class: 'fm-space-list fm-space-res' }, resources.map((r) => el('li', {}, [
          el('span', { class: 'fm-res-kind', text: KINDS[r.kind] || 'Link' }),
          el('span', {}, [
            el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', text: `${r.title} ↗` }),
            r.about ? el('small', { class: 'fm-muted', text: r.about }) : null
          ]),
          isMod(sp.key) ? el('button', { type: 'button', class: 'fm-text-btn', 'aria-label': `Remove ${r.title}`, text: '×', onclick: async () => { await db.from('forum_space_resources').delete().eq('id', r.id); rerender(); } }) : null
        ])))
        : el('p', { class: 'fm-muted fm-small', text: 'No resources yet.' }),
      isMod(sp.key) ? addResource(sp.key, rerender) : null
    ]);

    // Events
    const evCard = el('section', { class: 'fm-card fm-space-sec' }, [
      el('h3', { text: '📅 Upcoming events' }),
      events?.length
        ? el('ul', { class: 'fm-space-list' }, events.map((e) => el('li', {}, [
          el('a', { href: `#events/${e.id}`, text: e.title }),
          el('small', { class: 'fm-muted', text: `${new Date(e.starts_at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${e.format === 'online' ? 'Online' : [e.city, e.country].filter(Boolean).join(', ') || 'In person'}` })
        ])))
        : el('p', { class: 'fm-muted fm-small', text: 'No upcoming events in this space yet.' }),
      el('a', { class: 'fm-text-btn', href: '#events/new', text: 'Host an event for this space →' })
    ]);

    slot.replaceChildren(header, el('div', { class: 'fm-space-grid' }, [featuredCard, resCard, evCard]), el('h3', { class: 'fm-space-feed-title', text: 'Discussions' }));
    const f = $('[data-fm-post-form]'); if (f?.topic) f.topic.value = sp.key;
  }

  function addModerator(space, done) {
    const status = el('small', { class: 'fm-muted', role: 'status' });
    const input = el('input', { type: 'search', placeholder: 'Add a moderator: type a member’s name', 'aria-label': 'Find a member to make moderator', maxlength: '60' });
    const list = el('ul', { class: 'fm-space-pick' });
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = input.value.trim().replace(/[%_,()\\]/g, ' ');
        if (q.length < 2) { list.replaceChildren(); return; }
        const { data } = await db.from('forum_profiles').select('user_id,display_name,headline').eq('verification_status', 'approved').eq('is_suspended', false).ilike('display_name', `%${q}%`).limit(5);
        list.replaceChildren(...(data || []).map((p) => el('li', {}, [el('button', { type: 'button', class: 'fm-text-btn', text: `${p.display_name}${p.headline ? ` · ${p.headline}` : ''}`, onclick: async () => {
          const { error } = await db.from('forum_space_moderators').insert({ space, user_id: p.user_id, added_by: state.me?.user_id });
          status.textContent = error ? (error.code === '23505' ? 'Already a moderator.' : 'Could not add.') : '';
          if (!error) done();
        } })])));
      }, 300);
    });
    return el('details', { class: 'fm-space-admin' }, [el('summary', { text: 'Manage moderators (WHSF)' }), input, list, status]);
  }

  function addResource(space, done) {
    const status = el('small', { class: 'fm-muted', role: 'status' });
    const title = el('input', { name: 'title', maxlength: '120', placeholder: 'Title', 'aria-label': 'Resource title' });
    const url = el('input', { name: 'url', type: 'url', maxlength: '500', placeholder: 'https://…', 'aria-label': 'Resource link' });
    const about = el('input', { name: 'about', maxlength: '240', placeholder: 'One line about it (optional)', 'aria-label': 'About the resource' });
    const kind = el('select', { name: 'kind', 'aria-label': 'Type of resource' }, Object.entries(KINDS).map(([v, t2]) => el('option', { value: v, text: t2 })));
    const save = el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Add resource', onclick: async () => {
      if (title.value.trim().length < 3) { status.textContent = 'Add a title.'; return; }
      if (!/^https:\/\/\S+$/.test(url.value.trim())) { status.textContent = 'The link must start with https://'; return; }
      save.disabled = true;
      const { error } = await db.from('forum_space_resources').insert({ space, title: title.value.trim(), url: url.value.trim(), about: about.value.trim() || null, kind: kind.value, added_by: state.me.user_id });
      save.disabled = false;
      status.textContent = error ? 'Could not add the resource.' : '';
      if (!error) done();
    } });
    return el('details', { class: 'fm-space-admin' }, [el('summary', { text: 'Add a resource (moderators)' }), el('div', { class: 'fm-space-form' }, [title, url, about, kind, save]), status]);
  }

  // ---------------------------------------------------------------- spaces directory (#spaces)
  async function renderDirectory() {
    const box = $('[data-fm-spaces-dir]');
    if (!box || !state.me) return;
    await loadMine();
    const draw = () => box.replaceChildren(
      el('div', { class: 'fm-fund-head' }, [el('div', {}, [el('h2', { text: 'Spaces' }), el('p', { class: 'fm-muted', text: 'Communities around a topic. Join the ones you care about to follow their discussions, resources and events.' })])]),
      el('div', { class: 'fm-space-dir' }, F.SPACES.map((sp) => el('article', { class: 'fm-space-card' }, [
        el('span', { class: 'fm-space-emoji', 'aria-hidden': 'true', text: sp.emoji }),
        el('div', {}, [el('h3', { text: sp.name }), el('p', { class: 'fm-muted', text: sp.about }), el('small', { class: 'fm-muted', text: plural(counts.get(sp.key) || 0, 'member', 'members') })]),
        el('div', { class: 'fm-space-card-actions' }, [joinButton(sp.key, draw), el('a', { class: 'fm-text-btn', href: `#space/${sp.key}`, text: 'Open →' })])
      ])))
    );
    draw();
  }

  // ---------------------------------------------------------------- post cards: featured tag + feature action
  F.hooks.post.push((card, post) => {
    if (post.featured_at) {
      const tag = el('span', { class: 'fm-post-tag fm-featured-tag', text: '⭐ Featured' });
      const head = card.querySelector('.fm-post-head');
      head?.after(tag);
    }
    if (state.me && post.topic && post.topic !== 'general' && isMod(post.topic) && !post.is_hidden) {
      let actions = card.querySelector('.fm-post-actions');
      if (!actions) { actions = el('div', { class: 'fm-post-actions' }); card.append(actions); }
      actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: post.featured_at ? 'Remove from featured' : 'Feature in this space', onclick: async () => {
        const { error } = await db.rpc('forum_feature_post', { p_post: post.id, p_on: !post.featured_at });
        if (error) { const msg = el('p', { class: 'fm-status', role: 'status', text: error.message }); card.append(msg); setTimeout(() => msg.remove(), 6000); return; }
        F.loadFeed(true); renderSpace();
      } }));
    }
  });

  F.hooks.refresh.push(async () => { my.loaded = false; if (state.me) await loadMine(); });
  F.hooks.view.push((view) => {
    if (view === 'feed') renderSpace(); else $('[data-fm-space-slot]')?.replaceChildren();
    if (view === 'spaces') renderDirectory();
  });
})();
