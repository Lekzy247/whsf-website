// WHSF Forum add-on (forum.html): Facebook/Instagram-style engagement on posts.
// Reactions, who reacted, comments + replies + comment likes, share, save, edit, pin (staff).
// Access rules live in the database (supabase/migrations/20261012_forum_post_engagement.sql).
// All member-written text is inserted with textContent (via richText), never as HTML.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar, stamp, richText, confirmInline } = F;

  const REACTIONS = [
    // c = the colour of the button label once chosen (Facebook style: Like purple, Love red, faces amber).
    { k: 'like', e: '👍', t: 'Like', c: '#6d28d9' },
    { k: 'love', e: '❤️', t: 'Love', c: '#f33e58' },
    { k: 'care', e: '🤗', t: 'Care', c: '#e8a20c' },
    { k: 'funny', e: '😆', t: 'Haha', c: '#e8a20c' },
    { k: 'wow', e: '😮', t: 'Wow', c: '#e8a20c' },
    { k: 'sad', e: '😢', t: 'Sad', c: '#e8a20c' },
    { k: 'celebrate', e: '🎉', t: 'Celebrate', c: '#1f8a4c' },
    { k: 'support', e: '🤝', t: 'Support', c: '#0f8b8d' },
    { k: 'insightful', e: '💡', t: 'Insightful', c: '#c98a00' },
    { k: 'applause', e: '👏', t: 'Applause', c: '#e8a20c' },
    { k: 'thanks', e: '🙏', t: 'Thank you', c: '#e9710f' }
  ];
  const R = Object.fromEntries(REACTIONS.map((r) => [r.k, r]));
  // Facebook-style round badges: Like = white thumb on purple, Love = white heart on red; the rest use their emoji.
  const HEART = 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';
  function reactionBadge(k) {
    if (k === 'like' || k === 'love') {
      const svg = icon(k === 'like' ? ICONS.like : [HEART]);
      return el('span', { class: `fm-rbadge is-${k}`, title: R[k].t }, [svg]);
    }
    return el('span', { class: 'fm-rbadge is-emoji', title: R[k]?.t || '', text: R[k]?.e || '' });
  }
  const cards = new Map(); // post id -> { card, post, ui }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const icon = (paths) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    paths.forEach((d) => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); svg.append(p); });
    return svg;
  };
  const ICONS = {
    like: ['M7 10v11', 'M15 5.9 14 10h5.8a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 18.4 21H7V10l4.3-7.2A1.9 1.9 0 0 1 15 5.9z'],
    comment: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    share: ['M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7', 'M16 6l-4-4-4 4', 'M12 2v13'],
    save: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z']
  };
  const postUrl = (id) => `${location.origin}${location.pathname}#post/${id}`;
  // Comments: compact date + time ("Oct 12, 11:58 PM"); the full date, time and time zone show on hover.
  const shortTime = (iso) => {
    const d = new Date(iso);
    const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleString(undefined, opts);
  };

  // "⋯" options menu (posts and comments), like Facebook.
  function closeMenus() {
    document.querySelectorAll('.fm-menu-list:not([hidden])').forEach((list) => {
      list.hidden = true;
      list.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
  }
  function makeMenu(label, items) {
    items.forEach((n) => { n.setAttribute('role', 'menuitem'); n.className = 'fm-menu-item'; });
    const list = el('div', { class: 'fm-menu-list', role: 'menu', hidden: '' }, items);
    const btn = el('button', { class: 'fm-more-btn', type: 'button', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false', text: '⋯' });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = list.hidden;
      closeMenus();
      list.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    list.addEventListener('click', () => { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
    return el('div', { class: 'fm-menu' }, [btn, list]);
  }

  // ---------------------------------------------------------------- per-post engagement block
  F.hooks.post.push((card, post) => {
    if (!state.me && !state.isStaff) return;
    const member = Boolean(state.me);
    const ui = {};
    ui.summary = el('div', { class: 'fm-eng-sum' }, [
      ui.reactSum = el('button', { class: 'fm-eng-reacts', type: 'button', hidden: '', onclick: () => toggleReactors(post.id) }),
      el('span', { class: 'fm-eng-counts' }, [
        ui.commentSum = el('button', { class: 'fm-eng-count', type: 'button', hidden: '', 'aria-expanded': 'false', onclick: () => toggleComments(post.id) }),
        ui.shareSum = el('button', { class: 'fm-eng-count', type: 'button', hidden: '', onclick: () => toggleShare(post.id) })
      ])
    ]);
    ui.likeBtn = el('button', { class: 'fm-eng-btn fm-eng-like', type: 'button', 'aria-pressed': 'false', onclick: () => react(post.id, null) }, [icon(ICONS.like), el('span', { text: 'Like' })]);
    ui.pickBtn = el('button', { class: 'fm-eng-pick', type: 'button', 'aria-label': 'Choose a reaction', 'aria-expanded': 'false', text: '＋', onclick: () => showPicker(post.id, ui.picker.hidden) });
    ui.picker = el('div', { class: 'fm-reaction-picker', role: 'group', 'aria-label': 'Reactions', hidden: '' },
      REACTIONS.map((r) => el('button', { type: 'button', title: r.t, 'aria-label': r.t, text: r.e, onclick: () => react(post.id, r.k) })));
    const likeWrap = el('div', { class: 'fm-eng-likewrap' }, [ui.likeBtn, ui.pickBtn, ui.picker]);
    // Phone: press and hold Like to choose a reaction (a plain tap just likes), like Facebook.
    let pressTimer; let longPressed = false;
    ui.likeBtn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; showPicker(post.id, true); navigator.vibrate?.(15); }, 450);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => ui.likeBtn.addEventListener(t, () => clearTimeout(pressTimer)));
    ui.likeBtn.addEventListener('click', (e) => { if (longPressed) { e.stopImmediatePropagation(); longPressed = false; } }, true);
    ui.likeBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    // Desktop: hovering the Like button opens the reactions, like Facebook.
    let hoverTimer;
    likeWrap.addEventListener('mouseenter', () => { if (!matchMedia('(hover: hover)').matches) return; clearTimeout(hoverTimer); hoverTimer = setTimeout(() => showPicker(post.id, true), 450); });
    likeWrap.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => showPicker(post.id, false), 350); });

    ui.saveBtn = el('button', { class: 'fm-eng-btn', type: 'button', 'aria-pressed': 'false', onclick: () => toggleSave(post.id) }, [icon(ICONS.save), el('span', { text: 'Save' })]);
    ui.bar = el('div', { class: 'fm-eng-bar' }, [
      member ? likeWrap : null,
      el('button', { class: 'fm-eng-btn fm-eng-comment', type: 'button', 'aria-expanded': 'false', onclick: () => toggleComments(post.id, null, true) }, [icon(ICONS.comment), el('span', { text: 'Comment' })]),
      el('button', { class: 'fm-eng-btn', type: 'button', onclick: () => toggleShare(post.id) }, [icon(ICONS.share), el('span', { text: 'Share' })]),
      member ? ui.saveBtn : null
    ]);
    ui.panel = el('div', { class: 'fm-eng-panel', hidden: '' });
    ui.comments = el('section', { class: 'fm-comments', 'aria-label': 'Comments', hidden: '' });
    const block = el('div', { class: 'fm-eng' }, [ui.summary, ui.bar, ui.panel, ui.comments]);
    card.insertBefore(block, card.querySelector('.fm-post-actions'));

    // Extra post options: edit (author), pin (staff), copy link (everyone).
    let actions = card.querySelector('.fm-post-actions');
    if (!actions) { actions = el('div', { class: 'fm-post-actions' }); card.append(actions); }
    if (post.author_id === state.me?.user_id) actions.prepend(el('button', { class: 'fm-text-btn', type: 'button', text: 'Edit', onclick: () => editPost(post.id) }));
    if (state.isStaff) actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: post.is_pinned ? 'Unpin (moderator)' : 'Pin to top (moderator)', onclick: () => pinPost(post) }));
    actions.append(el('button', { class: 'fm-text-btn', type: 'button', text: 'Copy link', onclick: () => copyLink(post.id, null, null, c => flash(cards.get(post.id), c)) }));
    const items = [...actions.children];
    actions.remove();
    if (items.length) card.querySelector('.fm-post-head').append(makeMenu('Post options', items));

    cards.set(post.id, { card, post, ui, stats: null });
  });

  // After each page of posts loads: counts, my reaction, saved state.
  F.hooks.feed.push(async (posts) => {
    const ids = posts.map((p) => p.id).filter((id) => cards.has(id));
    await loadStats(ids);
    if (state.single && cards.has(state.single)) {
      const c = cards.get(state.single);
      c.expanded = true;
      toggleComments(state.single, true);
    }
    const withComments = ids.filter((id) => cards.get(id)?.stats?.comment_total && !cards.get(id).commentsLoaded);
    if (withComments.length) await prefetchComments(withComments);
  });

  async function loadStats(ids) {
    if (!ids.length) return;
    const { data } = await db.rpc('forum_post_stats', { p_ids: ids });
    (data || []).forEach((s) => { const c = cards.get(s.post_id); if (c) { c.stats = s; paint(c); } });
  }

  function paint(c) {
    const { ui, stats } = c;
    if (!stats) return;
    const topKeys = Object.entries(stats.reactions || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k).filter((k) => R[k]);
    ui.reactSum.replaceChildren(el('span', { class: 'fm-eng-emojis', 'aria-hidden': 'true' }, topKeys.map(reactionBadge)), el('span', { text: String(stats.reaction_total) }));
    ui.reactSum.setAttribute('aria-label', `${plural(stats.reaction_total, 'reaction', 'reactions')}. See who reacted.`);
    ui.reactSum.hidden = !stats.reaction_total;
    ui.commentSum.textContent = plural(stats.comment_total, 'comment', 'comments');
    ui.commentSum.hidden = !stats.comment_total;
    ui.shareSum.textContent = plural(stats.share_total || 0, 'share', 'shares');
    ui.shareSum.hidden = !stats.share_total;
    const mine = stats.my_reaction ? R[stats.my_reaction] : null;
    ui.likeBtn.setAttribute('aria-pressed', String(Boolean(mine)));
    ui.likeBtn.classList.toggle('is-on', Boolean(mine));
    ui.likeBtn.replaceChildren(
      !mine ? icon(ICONS.like) : mine.k === 'like' ? icon(ICONS.like) : el('span', { class: 'fm-eng-emoji', text: mine.e }),
      el('span', { text: mine ? mine.t : 'Like' }));
    ui.likeBtn.dataset.reaction = mine ? mine.k : '';
    ui.likeBtn.style.color = mine ? mine.c : '';
    ui.saveBtn.setAttribute('aria-pressed', String(Boolean(stats.saved)));
    ui.saveBtn.classList.toggle('is-on', Boolean(stats.saved));
    ui.saveBtn.querySelector('span').textContent = stats.saved ? 'Saved' : 'Save';
  }

  // ---------------------------------------------------------------- reactions
  document.addEventListener('pointerdown', (e) => {
    cards.forEach((c, id) => { if (!c.ui.picker.hidden && !c.ui.picker.parentElement.contains(e.target)) showPicker(id, false); });
  });
  function showPicker(id, open) {
    const c = cards.get(id); if (!c) return;
    c.ui.picker.hidden = !open;
    c.ui.pickBtn.setAttribute('aria-expanded', String(open));
  }
  async function react(id, kind) {
    const c = cards.get(id); if (!c || !state.me || c.reacting) return;
    showPicker(id, false);
    const current = c.stats?.my_reaction || null;
    const next = kind === null ? (current ? null : 'like') : (kind === current ? null : kind);
    // Show the change straight away; the database confirms it a moment later.
    if (c.stats) {
      const s = c.stats; const r = { ...(s.reactions || {}) };
      if (current) { r[current] = Math.max(0, (r[current] || 1) - 1); if (!r[current]) delete r[current]; }
      if (next) r[next] = (r[next] || 0) + 1;
      s.reactions = r;
      s.reaction_total = Math.max(0, (s.reaction_total || 0) + (next ? 1 : 0) - (current ? 1 : 0));
      s.my_reaction = next;
      paint(c);
    }
    c.reacting = true;
    const res = next
      ? await db.from('forum_reactions').upsert({ post_id: id, user_id: state.me.user_id, kind: next }, { onConflict: 'post_id,user_id' })
      : await db.from('forum_reactions').delete().eq('post_id', id).eq('user_id', state.me.user_id);
    c.reacting = false;
    if (res.error) { await loadStats([id]); return flash(c, 'Your reaction could not be saved. Please try again.'); }
    await loadStats([id]);
    if (!c.ui.panel.hidden && c.ui.panel.dataset.kind === 'reactors') showReactors(id);
  }
  function toggleReactors(id) {
    const c = cards.get(id);
    if (!c.ui.panel.hidden && c.ui.panel.dataset.kind === 'reactors') { c.ui.panel.hidden = true; return; }
    showReactors(id);
  }
  async function showReactors(id, filter = null) {
    const c = cards.get(id);
    const panel = c.ui.panel;
    panel.dataset.kind = 'reactors'; panel.hidden = false;
    panel.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading…' }));
    const { data, error } = await db.from('forum_reactions')
      .select('kind,created_at,user_id,user:forum_profiles!forum_reactions_user_id_fkey(display_name,headline,avatar_url)')
      .eq('post_id', id).order('created_at', { ascending: false }).limit(200);
    if (error) { panel.replaceChildren(el('p', { class: 'fm-muted', text: 'Reactions could not be loaded.' })); return; }
    const counts = {};
    data.forEach((r) => { counts[r.kind] = (counts[r.kind] || 0) + 1; });
    const tabs = el('div', { class: 'fm-topics fm-reactor-tabs' }, [
      el('button', { type: 'button', class: `fm-topic${filter ? '' : ' is-on'}`, text: `All ${data.length}`, onclick: () => showReactors(id, null) }),
      ...Object.entries(counts).map(([k, n]) => el('button', { type: 'button', class: `fm-topic${filter === k ? ' is-on' : ''}`, text: `${R[k]?.e || ''} ${n}`, title: R[k]?.t, onclick: () => showReactors(id, k) }))
    ]);
    const list = el('ul', { class: 'fm-reactors' });
    data.filter((r) => !filter || r.kind === filter).forEach((r) => {
      const av = el('div', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' }); fillAvatar(av, r.user || {});
      list.append(el('li', {}, [
        av,
        el('span', {}, [el('strong', { text: r.user?.display_name || 'Member' }), el('small', { text: r.user?.headline || '' })]),
        el('span', { class: 'fm-reactor-emoji', title: R[r.kind]?.t, text: R[r.kind]?.e || '' })
      ]));
    });
    panel.replaceChildren(
      el('div', { class: 'fm-eng-panel-head' }, [el('strong', { text: 'Reactions' }), el('button', { class: 'fm-text-btn', type: 'button', text: 'Close', onclick: () => { panel.hidden = true; } })]),
      tabs, list
    );
  }

  // ---------------------------------------------------------------- save
  async function toggleSave(id) {
    const c = cards.get(id); if (!c || !state.me) return;
    const saved = Boolean(c.stats?.saved);
    const res = saved
      ? await db.from('forum_saves').delete().eq('user_id', state.me.user_id).eq('post_id', id)
      : await db.from('forum_saves').insert({ user_id: state.me.user_id, post_id: id });
    if (res.error) return flash(c, 'Could not update your saved posts.');
    await loadStats([id]);
    flash(c, saved ? 'Removed from Saved posts.' : 'Saved. Find it under Me → Saved posts.');
    if (saved && state.saved) c.card.remove();
  }

  // ---------------------------------------------------------------- share
  function toggleShare(id) {
    const c = cards.get(id);
    const panel = c.ui.panel;
    if (!panel.hidden && panel.dataset.kind === 'share') { panel.hidden = true; return; }
    panel.dataset.kind = 'share'; panel.hidden = false;
    const url = postUrl(id);
    const text = 'See this post on the WHSF Forum';
    const enc = encodeURIComponent;
    const links = [
      ['WhatsApp', `https://wa.me/?text=${enc(`${text}: ${url}`)}`],
      ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`],
      ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`],
      ['X', `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`],
      ['Email', `mailto:?subject=${enc(text)}&body=${enc(url)}`]
    ];
    const status = el('p', { class: 'fm-status', role: 'status' });
    panel.replaceChildren(
      el('div', { class: 'fm-eng-panel-head' }, [el('strong', { text: 'Share this post' }), el('button', { class: 'fm-text-btn', type: 'button', text: 'Close', onclick: () => { panel.hidden = true; } })]),
      el('p', { class: 'fm-muted', text: 'Only signed-in, verified WHSF Forum members can open the post.' }),
      el('div', { class: 'fm-share-row' }, [
        el('button', { class: 'fm-share-btn', type: 'button', text: '🔗 Copy link', onclick: (e) => { copyLink(id, e.currentTarget, status); recordShare(id, 'link'); } }),
        navigator.share ? el('button', { class: 'fm-share-btn', type: 'button', text: '📱 Share…', onclick: () => navigator.share({ title: text, url }).then(() => recordShare(id, 'device')).catch(() => {}) }) : null,
        ...links.map(([name, href]) => el('a', { class: 'fm-share-btn', href, target: '_blank', rel: 'noopener noreferrer', text: name, onclick: () => recordShare(id, name.toLowerCase()) }))
      ]),
      status
    );
  }
  async function recordShare(id, channel) {
    if (!state.me) return;
    const { error } = await db.from('forum_shares').insert({ post_id: id, user_id: state.me.user_id, channel });
    if (!error) loadStats([id]); // a repeat share on the same channel is ignored (not double counted)
  }
  async function copyLink(id, btn, status, say) {
    try {
      await navigator.clipboard.writeText(postUrl(id));
      if (status) status.textContent = 'Link copied.';
      else if (say) say('Link copied.');
      else { const t = btn.textContent; btn.textContent = 'Link copied ✓'; setTimeout(() => { btn.textContent = t; }, 1800); }
    } catch {
      if (status) status.textContent = postUrl(id);
      else if (say) say(postUrl(id));
    }
  }

  // ---------------------------------------------------------------- edit + pin
  function editPost(id) {
    const c = cards.get(id);
    if (c.card.querySelector('.fm-edit-form')) return;
    const { post } = c;
    const body = el('textarea', { name: 'body', rows: '5', maxlength: '3000', required: '' }); body.value = F.decodeTags(body, post.body);
    const topic = el('select', { name: 'topic' }, [
      el('option', { value: 'general', text: '🏠 General' }),
      ...F.SPACES.map((sp) => el('option', { value: sp.key, text: `${sp.emoji} ${sp.name}` }))
    ]);
    topic.value = post.topic || 'general';
    const where = el('input', { name: 'location', maxlength: '80', placeholder: 'Location (optional)' }); where.value = post.location || '';
    const status = el('p', { class: 'fm-status', role: 'status' });
    const form = el('form', { class: 'fm-edit-form' }, [
      el('label', { class: 'fm-field' }, [el('span', { text: 'Edit your post' }), body]),
      F.formatBar(body),
      el('div', { class: 'fm-edit-row' }, [topic, where]),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: 'Save changes' }),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel', onclick: () => form.remove() })
      ]),
      status
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = F.encodeTags(body);
      if (!text) { status.textContent = 'Write something first.'; return; }
      const { data, error } = await db.from('forum_posts')
        .update({ body: text, topic: topic.value, location: where.value.trim() || null })
        .eq('id', id).select('edited_at').single();
      if (error) { status.textContent = 'Your changes could not be saved.'; return; }
      Object.assign(post, { body: text, topic: topic.value, location: where.value.trim() || null, edited_at: data.edited_at });
      replaceCard(id);
    });
    c.card.insertBefore(form, c.card.querySelector('.fm-eng'));
    F.attachTagging?.(body);
    body.focus();
  }
  async function pinPost(post) {
    const { error } = await db.from('forum_posts').update({ is_pinned: !post.is_pinned }).eq('id', post.id);
    if (!error) F.loadFeed(true);
  }
  function replaceCard(id) {
    const c = cards.get(id);
    const fresh = F.renderPost(c.post);
    c.card.replaceWith(fresh);
    loadStats([id]);
  }

  // ---------------------------------------------------------------- comments
  // Comments sit under their post. "N comments" and the Comment button open or collapse them.
  // open: true = open, false = collapse, null = toggle. focus: put the cursor in the comment box.
  function toggleComments(id, open = null, focus = false) {
    const c = cards.get(id); if (!c) return;
    const box = c.ui.comments;
    const show = open === null ? box.hidden : open;
    box.hidden = !show;
    c.ui.commentSum.setAttribute('aria-expanded', String(show));
    c.ui.bar.querySelector('.fm-eng-comment')?.setAttribute('aria-expanded', String(show));
    if (!show) {
      // Keep the post in view after a long thread collapses.
      if (c.card.getBoundingClientRect().top < 0) c.card.scrollIntoView({ block: 'start' });
      return;
    }
    if (!c.commentsLoaded) loadComments(id, focus);
    else if (focus) focusCommentBox(box);
  }

  const COMMENT_COLS = 'id,post_id,parent_id,body,created_at,edited_at,is_hidden,author_id,author:forum_profiles!forum_comments_author_id_fkey(display_name,headline,avatar_url),likes:forum_comment_likes(count)';
  async function myLikes(rows) {
    if (!state.me || !rows.length) return new Set();
    const { data } = await db.from('forum_comment_likes').select('comment_id').eq('user_id', state.me.user_id).in('comment_id', rows.map((x) => x.id));
    return new Set((data || []).map((x) => x.comment_id));
  }
  async function prefetchComments(ids) {
    const { data, error } = await db.from('forum_comments').select(COMMENT_COLS).in('post_id', ids).order('created_at', { ascending: true }).limit(600);
    if (error) return;
    const liked = await myLikes(data);
    ids.forEach((id) => {
      const c = cards.get(id);
      if (!c || c.commentsLoaded) return;
      c.commentData = data.filter((x) => x.post_id === id);
      c.liked = liked;
      c.commentsLoaded = true;
      renderComments(c);
    });
  }
  async function loadComments(id, focus = false) {
    const c = cards.get(id);
    const box = c.ui.comments;
    if (!c.commentData) box.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading comments…' }));
    const { data, error } = await db.from('forum_comments').select(COMMENT_COLS).eq('post_id', id).order('created_at', { ascending: true }).limit(300);
    if (error) { box.replaceChildren(el('p', { class: 'fm-muted', text: 'Comments could not be loaded.' })); return; }
    c.commentData = data;
    c.liked = await myLikes(data);
    c.commentsLoaded = true;
    renderComments(c);
    if (focus) focusCommentBox(box);
  }
  function focusCommentBox(box) {
    const ta = box.querySelector(':scope > .fm-c-form textarea');
    if (!ta) return;
    ta.focus({ preventScroll: true });
    ta.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  // Like Facebook: the two latest comments show first, with "View N more comments" above them.
  function renderComments(c) {
    const data = c.commentData || [];
    const top = data.filter((x) => !x.parent_id);
    const replies = (pid) => data.filter((x) => x.parent_id === pid);
    const PREVIEW = 2;
    const hiddenCount = c.expanded ? 0 : Math.max(0, top.length - PREVIEW);
    const list = el('ul', { class: 'fm-c-list' });
    top.slice(hiddenCount).forEach((cm) => {
      const item = renderComment(c, cm, c.liked || new Set());
      const sub = el('ul', { class: 'fm-c-replies' });
      replies(cm.id).forEach((r) => sub.append(renderComment(c, r, c.liked || new Set())));
      item.querySelector('.fm-c-main').append(sub);
      list.append(item);
    });
    // Keep a comment that is being typed when the list refreshes (for example after a Like).
    const draft = c.ui.comments.querySelector(':scope > .fm-c-form textarea');
    const keep = draft && draft.value ? { value: draft.value, mentions: draft._mentions } : null;
    c.ui.comments.replaceChildren(...[
      hiddenCount ? el('button', { class: 'fm-c-more', type: 'button', text: `View ${plural(hiddenCount, 'more comment', 'more comments')}`, onclick: () => { c.expanded = true; renderComments(c); } }) : null,
      data.length ? list : el('p', { class: 'fm-muted fm-c-empty', text: 'No comments yet. Be the first to comment.' }),
      state.me ? commentForm(c, null) : null,
      el('button', { class: 'fm-c-hide', type: 'button', text: 'Hide comments ▲', onclick: () => toggleComments(c.post.id, false) })
    ].filter(Boolean));
    if (keep) {
      const ta = c.ui.comments.querySelector(':scope > .fm-c-form textarea');
      if (ta) { ta.value = keep.value; ta._mentions = keep.mentions; ta.dispatchEvent(new Event('input')); }
    }
  }

  function renderComment(c, cm, liked) {
    const author = cm.author || {};
    const av = el('div', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' }); fillAvatar(av, author);
    const likes = cm.likes?.[0]?.count || 0;
    const isLiked = liked.has(cm.id);
    const mine = cm.author_id === state.me?.user_id;
    const ownsPost = c.post.author_id === state.me?.user_id;
    const li = el('li', { class: `fm-c${cm.is_hidden ? ' is-hidden' : ''}`, id: `comment-${cm.id}` });
    const bubble = el('div', { class: 'fm-c-bubble' }, [
      el('strong', { title: author.headline || '', text: author.display_name || 'Member' }),
      cm.is_hidden ? el('span', { class: 'fm-post-tag', text: 'Hidden by a moderator' }) : null,
      richText(cm.body, 'fm-c-body'),
      likes ? el('span', { class: 'fm-c-likes', title: plural(likes, 'like', 'likes'), text: `👍 ${likes}` }) : null
    ]);
    const tools = [];
    if (mine) tools.push(el('button', { type: 'button', text: 'Edit', onclick: () => editComment(c, li, cm) }));
    if (mine || ownsPost || state.isStaff) tools.push(el('button', { type: 'button', text: 'Delete', onclick: () => confirmInline(li.querySelector(':scope > .fm-c-main'), 'Delete this comment?', async () => {
      const { error } = await db.from('forum_comments').delete().eq('id', cm.id);
      if (!error) { await loadComments(c.post.id); loadStats([c.post.id]); }
    }) }));
    if (state.isStaff) tools.push(el('button', { type: 'button', text: cm.is_hidden ? 'Unhide (moderator)' : 'Hide (moderator)', onclick: async () => {
      const { error } = await db.from('forum_comments').update({ is_hidden: !cm.is_hidden }).eq('id', cm.id);
      if (!error) { await loadComments(c.post.id); loadStats([c.post.id]); }
    } }));
    const row = el('div', { class: 'fm-c-row' }, [bubble, tools.length ? makeMenu('Comment options', tools) : null]);
    const meta = el('div', { class: 'fm-c-meta' }, [
      el('time', { class: 'fm-c-time', datetime: cm.created_at, title: F.fullTime(cm.created_at), text: shortTime(cm.created_at) }),
      state.me ? el('button', { class: `fm-c-act${isLiked ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(isLiked), text: 'Like', onclick: () => likeComment(c, cm.id, isLiked) }) : null,
      state.me ? el('button', { class: 'fm-c-act', type: 'button', text: 'Reply', onclick: () => openReply(c, li, cm) }) : null,
      cm.edited_at ? el('span', { class: 'fm-edited', title: `Edited ${F.fullTime(cm.edited_at)}`, text: 'Edited' }) : null
    ]);
    li.append(av, el('div', { class: 'fm-c-main' }, [row, meta]));
    return li;
  }

  const SEND_ICON = ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4z'];
  function commentForm(c, parent) {
    const ta = el('textarea', { rows: '1', maxlength: '1500', placeholder: parent ? `Reply to ${parent.author?.display_name || 'this comment'}…` : 'Write a comment…', 'aria-label': parent ? 'Write a reply' : 'Write a comment' });
    const status = el('p', { class: 'fm-status', role: 'status' });
    const send = el('button', { class: 'fm-c-send', type: 'submit', 'aria-label': parent ? 'Post reply' : 'Post comment', disabled: '' }, [icon(SEND_ICON)]);
    const me = el('div', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' }); fillAvatar(me, state.me || {});
    const form = el('form', { class: `fm-c-form${parent ? ' is-reply' : ''}` }, [me, el('div', { class: 'fm-c-input' }, [ta, send]), status]);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; send.disabled = !ta.value.trim(); };
    ta.addEventListener('input', grow);
    F.attachTagging?.(ta);
    // Enter sends, Shift+Enter makes a new line (like Facebook and Instagram).
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = F.encodeTags(ta);
      if (!body) return;
      send.disabled = true;
      const { error } = await db.from('forum_comments').insert({ post_id: c.post.id, author_id: state.me.user_id, body, parent_id: parent?.id || null });
      if (error) { send.disabled = false; status.textContent = /too fast/i.test(error.message) ? error.message : 'Your comment could not be posted.'; return; }
      c.expanded = true;
      await loadComments(c.post.id);
      loadStats([c.post.id]);
    });
    return form;
  }
  function openReply(c, li, cm) {
    const host = li.parentElement.closest('.fm-c') || li; // replies stay one level deep
    const existing = host.querySelector(':scope > .fm-c-main > .fm-c-form');
    if (existing) { existing.querySelector('textarea').focus(); return; }
    const form = commentForm(c, cm);
    host.querySelector(':scope > .fm-c-main').append(form);
    const ta = form.querySelector('textarea');
    if (host !== li && cm.author?.display_name) {
      const name = cm.author.display_name.replace(/[[\]\n]/g, '').slice(0, 80);
      ta._mentions = new Map([[name, cm.author_id]]);
      ta.value = `@${name} `; ta.dispatchEvent(new Event('input'));
    }
    ta.focus();
  }
  async function likeComment(c, id, isLiked) {
    if (c.likingComment) return;
    // Show the change straight away, then save it.
    const cm = (c.commentData || []).find((x) => x.id === id);
    c.liked = new Set(c.liked || []);
    if (isLiked) c.liked.delete(id); else c.liked.add(id);
    if (cm) cm.likes = [{ count: Math.max(0, (cm.likes?.[0]?.count || 0) + (isLiked ? -1 : 1)) }];
    renderComments(c);
    c.likingComment = true;
    const res = isLiked
      ? await db.from('forum_comment_likes').delete().eq('comment_id', id).eq('user_id', state.me.user_id)
      : await db.from('forum_comment_likes').insert({ comment_id: id, user_id: state.me.user_id });
    c.likingComment = false;
    if (res.error) loadComments(c.post.id);
  }
  // Edit in place: Enter saves, Esc cancels (like Facebook).
  function editComment(c, li, cm) {
    const main = li.querySelector(':scope > .fm-c-main');
    const row = main.querySelector(':scope > .fm-c-row');
    if (main.querySelector(':scope > .fm-c-edit')) return;
    const ta = el('textarea', { rows: '1', maxlength: '1500', 'aria-label': 'Edit your comment' }); ta.value = F.decodeTags(ta, cm.body);
    const cancel = () => { form.remove(); row.hidden = false; };
    const form = el('form', { class: 'fm-c-edit' }, [
      el('div', { class: 'fm-c-input' }, [ta]),
      el('p', { class: 'fm-c-edit-hint' }, ['Enter to save · ', el('button', { class: 'fm-c-act', type: 'button', text: 'Cancel', onclick: cancel })])
    ]);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = F.encodeTags(ta); if (!body) return;
      const { error } = await db.from('forum_comments').update({ body }).eq('id', cm.id);
      if (!error) loadComments(c.post.id);
    });
    row.hidden = true;
    row.after(form);
    F.attachTagging?.(ta);
    grow(); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  function flash(c, text) {
    let n = c.card.querySelector('.fm-eng-flash');
    if (!n) { n = el('p', { class: 'fm-status fm-eng-flash', role: 'status' }); c.ui.bar.after(n); }
    n.textContent = text;
    clearTimeout(n._t); n._t = setTimeout(() => n.remove(), 3200);
  }

  // Close open reaction pickers when tapping elsewhere.
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.fm-menu')) closeMenus();
    if (e.target.closest('.fm-eng-likewrap')) return;
    cards.forEach((c, id) => { if (!c.ui.picker.hidden) showPicker(id, false); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  // The feed is rebuilt on every reload; forget cards that are no longer on the page.
  F.hooks.feed.unshift(() => { cards.forEach((c, id) => { if (!c.card.isConnected) cards.delete(id); }); });
})();
