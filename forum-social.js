// WHSF Forum add-on: private messages and alerts (notifications).
// Access rules live in the database (supabase/migrations/20261012_forum_messages_alerts.sql).
// All member-written text is inserted with textContent, never as HTML.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $, fillAvatar, timeAgo, stamp } = F;
  const POLL_MS = 30000;
  let currentThread = null;
  let threadTimer = null;
  const people = new Map(); // user_id -> profile (display name, headline, avatar)

  // ---------------------------------------------------------------- unread badges in the top bar
  function setBadge(sel, n) {
    const b = $(sel);
    if (!b) return;
    b.hidden = !n;
    b.textContent = n > 99 ? '99+' : String(n || '');
  }
  async function refreshBadges() {
    if (!state.profile) { setBadge('[data-fm-badge-messages]', 0); setBadge('[data-fm-badge-alerts]', 0); return; }
    const { data } = await db.rpc('forum_unread_counts');
    const row = Array.isArray(data) ? data[0] : data;
    setBadge('[data-fm-badge-messages]', state.me ? Number(row?.messages || 0) : 0);
    setBadge('[data-fm-badge-alerts]', Number(row?.alerts || 0));
  }
  setInterval(() => { if (!document.hidden) refreshBadges(); }, POLL_MS);

  async function loadPeople(ids) {
    const missing = [...new Set(ids)].filter((id) => id && !people.has(id));
    if (!missing.length) return;
    const { data } = await db.from('forum_profiles').select('user_id,display_name,headline,avatar_url').in('user_id', missing);
    (data || []).forEach((p) => people.set(p.user_id, p));
  }

  // ---------------------------------------------------------------- messages
  async function loadThreads() {
    const list = $('[data-fm-threads]');
    list.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading conversations…' }));
    const { data: threads, error } = await db.from('forum_threads').select('id,member_a,member_b,last_message_at').order('last_message_at', { ascending: false }).limit(50);
    if (error) { list.replaceChildren(el('p', { class: 'fm-muted', text: 'Conversations could not be loaded.' })); return; }
    const me = state.me.user_id;
    const other = (t) => (t.member_a === me ? t.member_b : t.member_a);
    await loadPeople(threads.map(other));
    // Last message + unread count per conversation.
    const ids = threads.map((t) => t.id);
    const last = new Map(); const unread = new Map();
    if (ids.length) {
      const { data: msgs } = await db.from('forum_messages').select('thread_id,sender_id,body,created_at,read_at').in('thread_id', ids).order('created_at', { ascending: false }).limit(400);
      (msgs || []).forEach((m) => {
        if (!last.has(m.thread_id)) last.set(m.thread_id, m);
        if (m.sender_id !== me && !m.read_at) unread.set(m.thread_id, (unread.get(m.thread_id) || 0) + 1);
      });
    }
    list.replaceChildren();
    if (!threads.length) list.append(el('p', { class: 'fm-muted', text: 'No conversations yet. Open Network and press Message on a member to start one.' }));
    threads.forEach((t) => {
      const p = people.get(other(t)) || { display_name: 'Member' };
      const avatar = el('span', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(avatar, p);
      const m = last.get(t.id);
      const n = unread.get(t.id) || 0;
      list.append(el('button', { class: `fm-thread${t.id === currentThread?.id ? ' is-on' : ''}${n ? ' is-unread' : ''}`, type: 'button', onclick: () => openThread(t, p) }, [
        avatar,
        el('span', { class: 'fm-thread-text' }, [
          el('strong', { text: p.display_name }),
          el('small', { text: m ? `${m.sender_id === me ? 'You: ' : ''}${m.body}` : 'Say hello' })
        ]),
        el('span', { class: 'fm-thread-meta' }, [
          el('small', { text: m ? timeAgo(m.created_at) : '' }),
          n ? el('b', { class: 'fm-dot', text: String(n) }) : null
        ])
      ]));
    });
  }

  async function openThread(thread, profile) {
    currentThread = { ...thread, profile };
    $('[data-fm-convo-empty]').hidden = true;
    $('[data-fm-convo]').hidden = false;
    $('[data-fm-messages-view]').classList.add('is-open');
    const head = $('[data-fm-convo-head]');
    const avatar = el('span', { class: 'fm-avatar', 'aria-hidden': 'true' }); fillAvatar(avatar, profile);
    head.replaceChildren(
      el('button', { class: 'fm-text-btn fm-convo-back', type: 'button', text: '← Back', onclick: closeThread }),
      avatar,
      el('span', {}, [el('strong', { text: profile.display_name }), el('small', { text: profile.headline || 'Member' })]),
      el('button', { class: 'fm-text-btn fm-small', type: 'button', text: 'Block', onclick: () => blockMember(profile) })
    );
    await renderMessages(true);
    clearInterval(threadTimer);
    threadTimer = setInterval(() => { if (!document.hidden && currentThread) renderMessages(false); }, 10000);
    $('[data-fm-send-form] textarea').focus();
  }
  function closeThread() {
    currentThread = null;
    clearInterval(threadTimer);
    $('[data-fm-messages-view]').classList.remove('is-open');
    $('[data-fm-convo]').hidden = true;
    $('[data-fm-convo-empty]').hidden = false;
    loadThreads();
  }

  async function renderMessages(scroll) {
    if (!currentThread) return;
    const box = $('[data-fm-convo-body]');
    const { data, error } = await db.from('forum_messages').select('id,sender_id,body,created_at').eq('thread_id', currentThread.id).order('created_at', { ascending: true }).limit(300);
    if (error) { box.replaceChildren(el('p', { class: 'fm-muted', text: 'Messages could not be loaded.' })); return; }
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.replaceChildren();
    if (!data.length) box.append(el('p', { class: 'fm-muted fm-convo-hint', text: `Start the conversation with ${currentThread.profile.display_name}. Be kind, and never share passwords or bank details.` }));
    data.forEach((m) => {
      const mine = m.sender_id === state.me.user_id;
      box.append(el('div', { class: `fm-bubble${mine ? ' is-mine' : ''}` }, [
        el('p', { text: m.body }),
        el('small', {}, [stamp(m.created_at)])
      ]));
    });
    if (scroll || atBottom) box.scrollTop = box.scrollHeight;
    await db.rpc('forum_mark_thread_read', { p_thread: currentThread.id });
    refreshBadges();
  }

  $('[data-fm-send-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentThread) return;
    const form = event.currentTarget;
    const body = form.body.value.trim();
    if (!body) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const { error } = await db.from('forum_messages').insert({ thread_id: currentThread.id, sender_id: state.me.user_id, body });
    button.disabled = false;
    F.setStatus('[data-fm-send-status]', error ? error.message : '');
    if (error) return;
    form.reset();
    await renderMessages(true);
  });
  $('[data-fm-send-form] textarea').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); }
  });

  async function blockMember(profile) {
    const box = $('[data-fm-convo-body]');
    const ask = el('div', { class: 'fm-confirm' }, [
      el('p', { text: `Block ${profile.display_name}? Neither of you will be able to message the other. To report a problem, use Report on a post or email info@worldhsfoundation.org.` }),
      el('div', { class: 'fm-actions' }, [
        el('button', { class: 'hp-btn hp-btn-primary', type: 'button', text: 'Block', onclick: async () => {
          const { error } = await db.from('forum_blocks').insert({ blocker_id: state.me.user_id, blocked_id: profile.user_id });
          ask.replaceChildren(el('p', { text: error ? `Could not block: ${error.message}` : `${profile.display_name} is blocked.` }));
        } }),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel', onclick: () => ask.remove() })
      ])
    ]);
    box.prepend(ask);
    box.scrollTop = 0;
  }

  // "Message" buttons elsewhere call this.
  F.startMessage = async (userId) => {
    const { data, error } = await db.rpc('forum_open_thread', { p_other: userId });
    if (error) { F.setStatus('[data-fm-people-status]', error.message); return; }
    await loadPeople([userId]);
    if (location.hash !== '#messages') location.hash = '#messages';
    const profile = people.get(userId) || { display_name: 'Member' };
    await loadThreads();
    openThread({ id: data }, profile);
  };

  // ---------------------------------------------------------------- alerts
  const KIND_ICON = { follow: '👋', message: '💬', id_approved: '✅', id_rejected: '⚠️', event_registration: '🎟️', event_update: '📅', advert_approved: '📣', advert_rejected: '📣', invite_joined: '🎉', reaction: '❤️', comment: '💬', reply: '↩️', security: '🛡️', mention: '🏷️', connect_request: '🤝', connect_accepted: '✅', collab_invite: '🤝', collab_accepted: '🎉' };
  async function loadAlerts() {
    const list = $('[data-fm-alerts]');
    list.replaceChildren(el('p', { class: 'fm-muted', text: 'Loading alerts…' }));
    const { data, error } = await db.from('forum_notifications').select('id,kind,body,link,created_at,read_at').order('created_at', { ascending: false }).limit(60);
    list.replaceChildren();
    if (error) { list.append(el('p', { class: 'fm-muted', text: 'Alerts could not be loaded.' })); return; }
    if (!data.length) list.append(el('p', { class: 'fm-muted', text: 'No alerts yet. You will see new followers, messages and updates here.' }));
    data.forEach((n) => {
      const row = el(n.link ? 'a' : 'div', { class: `fm-alert-row${n.read_at ? '' : ' is-new'}`, ...(n.link ? { href: n.link } : {}) }, [
        el('span', { class: 'fm-alert-icon', 'aria-hidden': 'true', text: KIND_ICON[n.kind] || '🔔' }),
        el('span', {}, [el('strong', { text: n.body }), el('small', {}, [stamp(n.created_at)])])
      ]);
      list.append(row);
    });
    if (data.some((n) => !n.read_at)) { await db.rpc('forum_mark_alerts_read'); refreshBadges(); }
  }

  // ---------------------------------------------------------------- wire into the forum page
  F.hooks.refresh.push(() => { refreshBadges(); });
  F.hooks.view.push((view) => {
    if (view !== 'messages') { clearInterval(threadTimer); }
    if (view === 'messages' && state.me) { if (!currentThread) loadThreads(); }
    if (view === 'alerts' && state.profile) loadAlerts();
  });
  if (state.session) refreshBadges();
})();
