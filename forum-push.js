// WHSF Forum add-on: "Add the Forum to your home screen" + phone / browser push notifications (Web Push).
// - Me page: an "App & notifications" panel (install steps for Android / iPhone / computer, notifications on / off).
// - Feed: a small one-time card inviting members to install and turn notifications on (can be dismissed).
// Subscriptions are stored in public.forum_push_subscriptions (own rows only). Pushes are sent by
// api/official-post-email.js when an official WHSF account posts. iPhone and iPad only allow web push for a site added
// to the Home Screen (iOS 16.4+), so the panel explains that first.
(() => {
  const F = window.WHSFForum;
  if (!F) return;
  const { db, state, el, $ } = F;
  const VAPID_PUBLIC_KEY = 'BJMjpUfjVWYqiPXYJUSIqfJs-56ijIRHawfOPx6xy-MaUOjr9HN5oSchKqRSotWXmzzYp19ROD0kWyC7pEK0cr0';
  const HIDE_KEY = 'whsf_forum_app_card_hidden';

  let installEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; refreshAll(); });
  window.addEventListener('appinstalled', () => { installEvent = null; refreshAll(); });

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

  function keyBytes(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  async function registration() {
    const existing = await navigator.serviceWorker.getRegistration('/');
    return existing || navigator.serviceWorker.register('/service-worker.js');
  }
  async function currentSubscription() {
    if (!pushSupported()) return null;
    try { return await (await registration()).pushManager.getSubscription(); } catch { return null; }
  }
  const deviceLabel = () => `${isIOS ? 'iPhone / iPad' : isAndroid ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device'} · ${/Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser'}`;

  async function turnOn() {
    if (!pushSupported()) throw new Error('This browser cannot show notifications.');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.'
      : 'Notifications were not allowed.');
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    const { error } = await db.from('forum_push_subscriptions').upsert({
      user_id: state.me.user_id, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, device_label: deviceLabel()
    }, { onConflict: 'endpoint' });
    if (error) { await sub.unsubscribe().catch(() => {}); throw new Error(`Could not save: ${error.message}`); }
  }
  async function turnOff() {
    const sub = await currentSubscription();
    if (!sub) return;
    await db.from('forum_push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe().catch(() => {});
  }

  // Install steps for this device.
  function installBlock() {
    const block = el('div', { class: 'fm-sec-block' });
    if (standalone()) {
      block.append(el('div', { class: 'fm-sec-row' }, [el('strong', { text: 'Forum on your home screen' }), el('span', { class: 'fm-sec-pill is-on', text: 'Added' })]),
        el('p', { class: 'fm-small fm-muted', text: 'You are using the Forum app. Open it from your home screen any time.' }));
      return block;
    }
    block.append(el('div', { class: 'fm-sec-row' }, [el('strong', { text: 'Add the Forum to your home screen' }), el('span', { class: 'fm-sec-pill', text: 'Not added' })]),
      el('p', { class: 'fm-small fm-muted', text: 'Open the Forum in one tap, like an app. Nothing to download from an app store.' }));
    if (installEvent) {
      const status = el('p', { class: 'fm-status', role: 'status' });
      block.append(el('button', { type: 'button', class: 'hp-btn hp-btn-primary', text: 'Add to home screen', onclick: async () => {
        installEvent.prompt();
        const choice = await installEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
        installEvent = null;
        status.textContent = choice.outcome === 'accepted' ? 'Added. Look for "WHSF Forum" on your home screen.' : 'Not added. You can try again later.';
      } }), status);
    } else if (isIOS) {
      block.append(el('ol', { class: 'fm-sec-steps' }, [
        el('li', {}, ['Open this page in ', el('strong', { text: 'Safari' }), '.']),
        el('li', {}, ['Tap the ', el('strong', { text: 'Share' }), ' button (the square with an arrow ⬆) at the bottom or top of the screen.']),
        el('li', {}, ['Scroll and tap ', el('strong', { text: 'Add to Home Screen' }), ', then ', el('strong', { text: 'Add' }), '.']),
        el('li', { text: 'Open "WHSF Forum" from your home screen.' })
      ]));
    } else if (isAndroid) {
      block.append(el('ol', { class: 'fm-sec-steps' }, [
        el('li', {}, ['Tap the browser menu ', el('strong', { text: '⋮' }), ' (top right).']),
        el('li', {}, ['Tap ', el('strong', { text: 'Add to Home screen' }), ' or ', el('strong', { text: 'Install app' }), ', then ', el('strong', { text: 'Add' }), '.'])
      ]));
    } else {
      block.append(el('p', { class: 'fm-small', text: 'On a computer: in Chrome or Edge, click the install icon at the right of the address bar (or the menu → Install WHSF Forum). On a phone, open this page and follow the steps shown there.' }));
    }
    return block;
  }

  // Notifications on / off for this device.
  async function pushBlock() {
    const block = el('div', { class: 'fm-sec-block' });
    const status = el('p', { class: 'fm-status', role: 'status', 'aria-live': 'polite' });
    const head = (on, label) => el('div', { class: 'fm-sec-row' }, [el('strong', { text: 'Phone notifications' }), el('span', { class: `fm-sec-pill${on ? ' is-on' : ''}`, text: label })]);
    if (isIOS && !standalone()) {
      block.append(head(false, 'Off'), el('p', { class: 'fm-small fm-muted', text: 'On iPhone and iPad, first add the Forum to your Home Screen (steps above), open it from there, then come back here to turn notifications on.' }));
      return block;
    }
    if (!pushSupported()) {
      block.append(head(false, 'Not available'), el('p', { class: 'fm-small fm-muted', text: 'This browser cannot show notifications. Try Chrome, Edge, Samsung Internet or Firefox, or the Forum app on your home screen.' }));
      return block;
    }
    const sub = await currentSubscription();
    const blocked = Notification.permission === 'denied';
    const on = Boolean(sub) && Notification.permission === 'granted';
    block.append(head(on, on ? 'On for this device' : blocked ? 'Blocked' : 'Off'),
      el('p', { class: 'fm-small fm-muted', text: 'Get a notification on this device when WHSF posts an update. Turn it on for each phone or computer you use.' }));
    if (blocked) block.append(el('p', { class: 'fm-small', text: 'Notifications are blocked for this site. Allow them in your browser settings (site settings → Notifications) or phone settings, then reload this page.' }));
    const btn = el('button', { type: 'button', class: on ? 'fm-text-btn' : 'hp-btn hp-btn-primary', text: on ? 'Turn off on this device' : 'Turn on notifications', onclick: async () => {
      btn.disabled = true; status.textContent = 'Working…';
      try {
        if (on) { await turnOff(); status.textContent = 'Notifications are off for this device.'; }
        else { await turnOn(); status.textContent = 'Done. You will get a notification when WHSF posts.'; }
        setTimeout(refreshAll, 900);
      } catch (err) { status.textContent = err.message || 'Something went wrong. Please try again.'; btn.disabled = false; }
    } });
    if (!blocked) block.append(btn);
    block.append(status);
    return block;
  }

  let panel = null;
  async function renderMe() {
    const host = $('[data-fm-view="me"]');
    if (!host || !state.me) return;
    panel?.remove();
    panel = el('section', { class: 'fm-security fm-app-panel', 'aria-labelledby': 'fm-app-title' }, [
      el('h2', { id: 'fm-app-title', text: 'App & notifications' }),
      el('p', { class: 'fm-muted', text: 'Use the Forum like an app and hear about WHSF updates straight away.' }),
      installBlock(),
      await pushBlock()
    ]);
    const security = host.querySelector(':scope > .fm-security:not(.fm-app-panel)');
    if (security) security.before(panel); else host.append(panel);
  }

  // One-time invitation on the feed for members who have neither installed the app nor turned notifications on.
  async function renderFeedCard() {
    document.querySelector('[data-fm-app-card]')?.remove();
    if (!state.me || store.get(HIDE_KEY)) return;
    const sub = pushSupported() ? await currentSubscription() : null;
    if (standalone() && sub) return;
    const slot = $('[data-fm-hubs-slot]');
    if (!slot) return;
    const card = el('section', { class: 'fm-card fm-app-card', 'data-fm-app-card': '', 'aria-label': 'Get the WHSF Forum app' }, [
      el('div', {}, [
        el('strong', { text: '📲 Get the WHSF Forum on your phone' }),
        el('p', { class: 'fm-small fm-muted', text: 'Add it to your home screen and get a notification when WHSF posts.' })
      ]),
      el('div', { class: 'fm-actions' }, [
        el('a', { class: 'hp-btn hp-btn-primary', href: '#me', text: 'Set it up', onclick: () => setTimeout(() => $('.fm-app-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600) }),
        el('button', { type: 'button', class: 'fm-text-btn', text: 'Not now', onclick: () => { store.set(HIDE_KEY, '1'); card.remove(); } })
      ])
    ]);
    slot.before(card);
  }

  function refreshAll() {
    const view = (location.hash || '#feed').slice(1).split('/')[0] || 'feed';
    if (view === 'me') renderMe();
    if (view === 'feed') renderFeedCard();
  }
  F.hooks.view.push((view) => { if (view === 'me') renderMe(); if (view === 'feed') renderFeedCard(); else document.querySelector('[data-fm-app-card]')?.remove(); });
  F.hooks.refresh.push(refreshAll);
})();
