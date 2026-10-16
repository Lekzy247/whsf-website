// WHSF Forum add-on: Me → Security. Authenticator app (Supabase MFA, free), devices that can sign in without a
// code, and "sign out everywhere else". Suspicious sign-ins are checked in forum.js + forum_session_check().
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  let box = null;

  const sha256Hex = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const when = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  async function render() {
    const host = $('[data-fm-view="me"]');
    if (!host || !state.me) return;
    box?.remove();
    box = el('section', { class: 'fm-security', id: 'security', 'aria-labelledby': 'fm-sec-title' }, [el('p', { class: 'fm-muted', text: 'Loading security settings…' })]);
    host.append(box);
    const status = el('p', { class: 'fm-status', role: 'status', 'aria-live': 'polite' });
    const [{ data: factors }, { data: devices }, myHash] = await Promise.all([
      db.auth.mfa.listFactors(),
      db.from('forum_known_devices').select('device_hash,label,first_seen,last_seen,last_country').order('last_seen', { ascending: false }),
      sha256Hex(F.deviceKey())
    ]);
    const app = (factors?.totp || []).find((f) => f.status === 'verified');

    // Authenticator app
    const appBox = el('div', { class: 'fm-sec-block' });
    const drawApp = () => {
      appBox.replaceChildren(
        el('div', { class: 'fm-sec-row' }, [
          el('div', {}, [
            el('strong', { text: 'Authenticator app' }),
            el('p', { class: 'fm-small fm-muted', text: app
              ? 'On. When a sign-in looks unusual, we ask for the code from your app instead of an email code.'
              : 'Stronger protection: use a free app such as Microsoft Authenticator or Google Authenticator for unusual sign-ins.' })
          ]),
          el('span', { class: `fm-sec-pill${app ? ' is-on' : ''}`, text: app ? 'On' : 'Off' })
        ]),
        app
          ? el('button', { class: 'fm-text-btn', type: 'button', text: 'Turn off authenticator app', onclick: async () => {
            const { error } = await db.auth.mfa.unenroll({ factorId: app.id });
            if (error) status.textContent = 'To turn it off, sign out, sign in again and confirm with your app code, then try again.';
            else render();
          } })
          : el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Turn on authenticator app', onclick: enroll })
      );
    };
    async function enroll() {
      status.textContent = 'Preparing…';
      // Remove any half-finished setup first.
      for (const f of (factors?.all || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) await db.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'WHSF Forum', issuer: 'WHSF Forum' });
      if (error) { status.textContent = 'The authenticator app could not be set up right now. Please try again later.'; return; }
      status.textContent = '';
      const qr = String(data.totp.qr_code || '');
      const code = el('input', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '123456', 'aria-label': 'Code from the app' });
      const save = el('button', { class: 'hp-btn hp-btn-primary', type: 'submit', text: 'Turn on' });
      appBox.replaceChildren(
        el('strong', { text: 'Set up your authenticator app' }),
        el('ol', { class: 'fm-sec-steps' }, [
          el('li', { text: 'Install Microsoft Authenticator or Google Authenticator on your phone (free).' }),
          el('li', { text: 'In the app, add an account and scan this QR code. Or type the setup key below.' }),
          el('li', { text: 'Enter the 6-digit code the app shows.' })
        ]),
        el('img', { class: 'fm-sec-qr', alt: 'QR code to add WHSF Forum to your authenticator app', src: qr.startsWith('data:') ? qr : `data:image/svg+xml;utf8,${encodeURIComponent(qr)}` }),
        el('p', { class: 'fm-small' }, [el('span', { class: 'fm-muted', text: 'Setup key: ' }), el('code', { class: 'fm-sec-key', text: data.totp.secret })]),
        el('form', { class: 'fm-stepup-form', novalidate: '', onsubmit: async (ev) => {
          ev.preventDefault();
          const token = code.value.replace(/\D/g, '');
          if (token.length !== 6) { status.textContent = 'Enter the 6-digit code from the app.'; return; }
          save.disabled = true;
          const { error: vErr } = await db.auth.mfa.challengeAndVerify({ factorId: data.id, code: token });
          save.disabled = false;
          if (vErr) { status.textContent = 'That code did not work. Wait for a new code in the app and try again.'; return; }
          status.textContent = 'Authenticator app turned on.';
          render();
        } }, [el('label', {}, ['Code from the app', code]), save]),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Cancel', onclick: async () => { await db.auth.mfa.unenroll({ factorId: data.id }); render(); } })
      );
      code.focus();
    }
    drawApp();

    // Devices
    const list = el('ul', { class: 'fm-sec-devices' });
    (devices || []).forEach((d) => {
      const mine = d.device_hash === myHash;
      list.append(el('li', {}, [
        el('span', { class: 'fm-sec-dev-icon', 'aria-hidden': 'true', text: /iPhone|Android/.test(d.label || '') ? '📱' : '💻' }),
        el('div', {}, [
          el('strong', { text: `${d.label || 'Browser'}${mine ? ' · This device' : ''}` }),
          el('small', { class: 'fm-muted', text: `Last used ${when(d.last_seen)}${d.last_country ? ` · ${d.last_country}` : ''} · First used ${when(d.first_seen)}` })
        ]),
        el('button', { class: 'fm-text-btn', type: 'button', text: 'Remove', onclick: async () => {
          const { error } = await db.from('forum_known_devices').delete().eq('device_hash', d.device_hash);
          if (error) status.textContent = error.message; else render();
        } })
      ]));
    });

    box.replaceChildren(
      el('h2', { id: 'fm-sec-title', text: 'Security' }),
      el('p', { class: 'fm-muted', text: 'When someone signs in to your account from a new device or a new country, we ask them to confirm it\'s you with a one-time code. Without the code, they can\'t see or post anything.' }),
      appBox,
      el('div', { class: 'fm-sec-block' }, [
        el('strong', { text: 'Recognised devices' }),
        el('p', { class: 'fm-small fm-muted', text: 'These devices can sign in without a code. Remove any you don\'t recognise, then change your password.' }),
        (devices || []).length ? list : el('p', { class: 'fm-small fm-muted', text: 'No devices yet.' })
      ]),
      el('div', { class: 'fm-sec-block' }, [
        el('strong', { text: 'Signed in somewhere else?' }),
        el('p', { class: 'fm-small fm-muted', text: 'Sign out of the WHSF Forum on every other phone and computer. This device stays signed in.' }),
        el('button', { class: 'hp-btn hp-btn-outline', type: 'button', text: 'Sign out all other devices', onclick: async () => {
          const { error } = await db.auth.signOut({ scope: 'others' });
          status.textContent = error ? 'Could not sign out other devices. Please try again.' : 'Done. Every other device has been signed out.';
        } })
      ]),
      await blockedAndMuted(),
      status
    );
    // Menu links #me/security and #me/blocked put this section first on the page (the Forum resets scrolling).
    if (location.hash === '#me/security' || location.hash === '#me/blocked') {
      host.prepend(box); box.classList.add('is-first');
      if (location.hash === '#me/blocked') box.insertBefore(box.querySelector('#blocked'), box.children[1] || null);
    }
  }

  // Blocked & muted members, with Unblock / Unmute (block and mute are on each post's ⋯ menu and on profiles).
  async function blockedAndMuted() {
    const block = el('div', { class: 'fm-sec-block', id: 'blocked' });
    const draw = async () => {
      const { data, error } = await db.rpc('forum_my_blocks_and_mutes');
      const rows = data || [];
      const item = (r) => {
        const av = el('span', { class: 'fm-avatar', 'aria-hidden': 'true' }); F.fillAvatar?.(av, r);
        const undo = el('button', { type: 'button', class: 'fm-text-btn', text: r.kind === 'block' ? 'Unblock' : 'Unmute', onclick: async () => {
          undo.disabled = true;
          const q = r.kind === 'block'
            ? db.from('forum_blocks').delete().eq('blocker_id', state.me.user_id).eq('blocked_id', r.user_id)
            : db.from('forum_mutes').delete().eq('muter_id', state.me.user_id).eq('muted_id', r.user_id);
          const { error: e } = await q;
          if (e) { undo.disabled = false; undo.textContent = 'Try again'; return; }
          draw();
          F.loadFeed?.(true);
        } });
        return el('li', {}, [av, el('div', {}, [el('strong', { text: r.display_name || 'Member' }), el('small', { class: 'fm-muted', text: r.kind === 'block' ? 'Blocked' : 'Muted' })]), undo]);
      };
      block.replaceChildren(
        el('strong', { text: 'Blocked & muted' }),
        el('p', { class: 'fm-small fm-muted', text: 'Muted: you don\'t see their posts or comments. Blocked: neither of you sees the other, and you can\'t message each other. They are not told. Use ⋯ on a post, or a profile, to mute or block someone.' }),
        error ? el('p', { class: 'fm-small', text: 'Could not load the list. Please refresh.' })
          : rows.length ? el('ul', { class: 'fm-sec-devices' }, rows.map(item)) : el('p', { class: 'fm-small fm-muted', text: 'You have not blocked or muted anyone.' })
      );
    };
    await draw();
    return block;
  }

  F.hooks.view.push((view) => { if (view === 'me') render(); });
})();
