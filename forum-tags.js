// WHSF Forum add-on: @mention and #hashtag suggestions while typing, and the "Trending hashtags" panel.
// Typing @ followed by a name lists verified members; picking one tags them (they get an alert).
// Typing # lists hashtags already used on the Forum. Mentions are stored by forum.js encodeTags().
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  let trending = [];

  async function loadTrending() {
    const box = $('[data-fm-trending]');
    if (!state.me) { if (box) box.hidden = true; trending = []; return; }
    const { data } = await db.rpc('forum_trending_hashtags', { p_days: 30, p_limit: 30 });
    trending = data || [];
    if (!box) return;
    const top = trending.slice(0, 8);
    box.hidden = !top.length;
    box.replaceChildren(
      el('h2', { text: 'Trending hashtags' }),
      el('ol', { class: 'fm-trend-list' }, top.map((t, i) => el('li', {}, [
        el('button', { class: 'fm-trend', type: 'button', onclick: () => F.setSearch(`#${t.tag}`) }, [
          el('span', { class: 'fm-trend-rank', text: String(i + 1) }),
          el('span', { class: 'fm-trend-text' }, [el('strong', { text: `#${t.tag}` }), el('small', { text: `${t.posts} post${Number(t.posts) === 1 ? '' : 's'} this month` })])
        ])
      ]))),
      el('p', { class: 'fm-small fm-muted', text: 'Add #hashtags to your posts so more people find them. Type @ to tag a member.' })
    );
  }

  function attachTagging(ta) {
    if (!ta || ta.dataset.fmTagging) return;
    ta.dataset.fmTagging = '1';
    ta._mentions = ta._mentions || new Map();
    const host = ta.parentElement;
    host.classList.add('fm-tag-host');
    const menu = el('ul', { class: 'fm-tag-menu', role: 'listbox', 'aria-label': 'Suggestions', hidden: '' });
    host.append(menu);
    let items = []; let active = 0; let ctx = null; let timer = null;
    const close = () => { menu.hidden = true; items = []; ctx = null; };
    const pick = (i) => {
      const it = items[i];
      if (!it || !ctx) return;
      const before = ta.value.slice(0, ctx.start);
      const after = ta.value.slice(ta.selectionStart);
      const insert = it.type === 'mention' ? `@${it.name} ` : `#${it.tag} `;
      if (it.type === 'mention') ta._mentions.set(it.name, it.id);
      ta.value = before + insert + after;
      const pos = (before + insert).length;
      ta.setSelectionRange(pos, pos);
      close();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.focus();
    };
    const draw = () => {
      menu.replaceChildren(...items.map((it, i) => {
        const li = el('li', { role: 'option', class: i === active ? 'is-active' : '', 'aria-selected': String(i === active) });
        li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(i); });
        if (it.type === 'mention') {
          const av = el('span', { class: 'fm-avatar fm-avatar-sm', 'aria-hidden': 'true' });
          F.fillAvatar(av, it.p);
          li.append(av, el('span', { class: 'fm-tag-text' }, [el('strong', { text: it.name }), it.p.headline ? el('small', { text: it.p.headline }) : null]));
        } else {
          li.append(el('span', { class: 'fm-tag-hash', 'aria-hidden': 'true', text: '#' }),
            el('span', { class: 'fm-tag-text' }, [el('strong', { text: `#${it.tag}` }), el('small', { text: `${it.posts} post${Number(it.posts) === 1 ? '' : 's'}` })]));
        }
        return li;
      }));
      menu.hidden = !items.length;
    };
    const update = () => {
      clearTimeout(timer);
      const upto = ta.value.slice(0, ta.selectionStart);
      const m = upto.match(/(?:^|\s)([@#])([\p{L}\p{N}_.'-]{1,30}(?: [\p{L}\p{N}_.'-]{0,30})?)$/u);
      if (!m) { close(); return; }
      const [, sym, q] = m;
      if (sym === '#' && !/^[\p{L}\p{N}_]+$/u.test(q)) { close(); return; }
      ctx = { start: upto.length - q.length - 1, q };
      if (sym === '#') {
        const ql = q.toLowerCase();
        items = trending.filter((t) => t.tag.startsWith(ql) && t.tag !== ql).slice(0, 6).map((t) => ({ type: 'tag', tag: t.tag, posts: t.posts }));
        active = 0; draw();
        return;
      }
      timer = setTimeout(async () => {
        const term = q.trim().replace(/[%_,()\\]/g, ' ');
        if (!term || !state.me) { close(); return; }
        const { data } = await db.from('forum_profiles').select('user_id,display_name,headline,avatar_url')
          .eq('verification_status', 'approved').eq('is_suspended', false).ilike('display_name', `%${term}%`).limit(6);
        if (!ctx || ctx.q !== q) return;
        items = (data || []).filter((p) => p.display_name && p.user_id !== state.me.user_id)
          .map((p) => ({ type: 'mention', id: p.user_id, name: p.display_name.replace(/[[\]\n]/g, '').slice(0, 80), p }));
        active = 0; draw();
      }, 180);
    };
    // Capture phase so Enter picks a suggestion instead of sending the comment.
    host.addEventListener('keydown', (e) => {
      if (menu.hidden || e.target !== ta || !items.length) return;
      if (e.key === 'ArrowDown') { active = (active + 1) % items.length; draw(); }
      else if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % items.length; draw(); }
      else if (e.key === 'Enter' || e.key === 'Tab') pick(active);
      else if (e.key === 'Escape') close();
      else return;
      e.preventDefault(); e.stopPropagation();
    }, true);
    ta.addEventListener('input', update);
    ta.addEventListener('click', update);
    ta.addEventListener('blur', () => setTimeout(close, 150));
  }

  F.attachTagging = attachTagging;
  attachTagging($('[data-fm-post-form] textarea[name="body"]'));
  F.hooks.refresh.push(loadTrending);
})();
