(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  let activeNotice = null;

  function ensureNoticeStyles() {
    if (document.getElementById('agrismart-runtime-notice-styles')) return;
    const style = document.createElement('style');
    style.id = 'agrismart-runtime-notice-styles';
    style.textContent = `
      .agrismart-runtime-notice{position:fixed;right:18px;bottom:18px;z-index:9999;max-width:390px;padding:16px;border-radius:14px;background:#fff;color:#17352b;box-shadow:0 14px 42px rgba(0,0,0,.2);border:1px solid rgba(13,77,53,.16);font:500 14px/1.45 Inter,system-ui,sans-serif}
      .agrismart-runtime-notice strong{display:block;margin-bottom:5px;font-size:15px}
      .agrismart-runtime-notice p{margin:0;color:#52645e}
      .agrismart-runtime-notice-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:13px}
      .agrismart-runtime-notice button{border:0;border-radius:9px;padding:8px 12px;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}
      .agrismart-runtime-notice .notice-primary{background:#0d4d35;color:#fff}
      .agrismart-runtime-notice .notice-secondary{background:#edf3ef;color:#17352b}
      @media(max-width:600px){.agrismart-runtime-notice{left:12px;right:12px;bottom:76px;max-width:none}}
    `;
    document.head.appendChild(style);
  }

  function dismissNotice() {
    activeNotice?.remove();
    activeNotice = null;
  }

  function showNotice({ title, message, actionLabel, onAction, persistent = false }) {
    ensureNoticeStyles();
    dismissNotice();

    const notice = document.createElement('aside');
    notice.className = 'agrismart-runtime-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');

    const heading = document.createElement('strong');
    heading.textContent = title;
    const body = document.createElement('p');
    body.textContent = message;
    notice.append(heading, body);

    const actions = document.createElement('div');
    actions.className = 'agrismart-runtime-notice-actions';

    if (actionLabel && typeof onAction === 'function') {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'notice-primary';
      action.textContent = actionLabel;
      action.addEventListener('click', onAction, { once: true });
      actions.appendChild(action);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'notice-secondary';
    close.textContent = 'Dismiss';
    close.addEventListener('click', dismissNotice);
    actions.appendChild(close);
    notice.appendChild(actions);

    document.body.appendChild(notice);
    activeNotice = notice;

    if (!persistent) window.setTimeout(() => {
      if (activeNotice === notice) dismissNotice();
    }, 7000);
  }

  function updateConnectivityDisplay(online) {
    const chip = document.querySelector('[data-connectivity]');
    if (!chip) return;
    chip.textContent = online ? 'Online' : 'Offline';
    chip.dataset.state = online ? 'online' : 'offline';
    chip.title = online
      ? 'Connected. Pending records can synchronize.'
      : 'Offline mode. Your changes will remain on this device until connectivity returns.';
  }

  function announceUpdate(registration) {
    const activate = () => registration.waiting?.postMessage({ type: 'AGRISMART_SKIP_WAITING' });
    window.dispatchEvent(new CustomEvent('agrismart:updateavailable', {
      detail: { registration, activate }
    }));
    showNotice({
      title: 'AgriSmart update available',
      message: 'A newer version is ready. Update now to receive the latest improvements.',
      actionLabel: 'Update now',
      onAction: activate,
      persistent: true
    });
  }

  async function requestBackgroundSync(registration) {
    if (!('sync' in registration)) return false;
    try {
      await registration.sync.register('agrismart-data-sync');
      return true;
    } catch (error) {
      console.warn('AgriSmart background sync registration was unavailable.', error);
      return false;
    }
  }

  window.addEventListener('load', async () => {
    updateConnectivityDisplay(navigator.onLine);

    try {
      const registration = await navigator.serviceWorker.register(
        '/agrismart/service-worker.js',
        { scope: '/agrismart/', updateViaCache: 'none' }
      );

      await requestBackgroundSync(registration);
      if (registration.waiting) announceUpdate(registration);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate(registration);
          }
        });
      });

      window.addEventListener('online', () => {
        updateConnectivityDisplay(true);
        showNotice({
          title: 'Connection restored',
          message: 'AgriSmart is online again and pending records will be synchronized.'
        });
        registration.update().catch(() => {});
        requestBackgroundSync(registration);
      });

      window.addEventListener('offline', () => {
        updateConnectivityDisplay(false);
        showNotice({
          title: 'You are offline',
          message: 'You can continue working. Records will remain on this device until your connection returns.'
        });
      });

      window.addEventListener('agrismart:syncstatus', event => {
        if (Number(event.detail?.pending || 0) > 0) requestBackgroundSync(registration);
      });

      window.AgriSmartServiceWorker = Object.freeze({
        registration,
        checkForUpdates: () => registration.update(),
        activateUpdate: () => registration.waiting?.postMessage({ type: 'AGRISMART_SKIP_WAITING' }),
        requestBackgroundSync: () => requestBackgroundSync(registration)
      });
    } catch (error) {
      console.error('AgriSmart service worker registration failed.', error);
      const message = String(error?.message || error);
      window.dispatchEvent(new CustomEvent('agrismart:serviceworkererror', { detail: { message } }));
      showNotice({
        title: 'Offline support unavailable',
        message: 'AgriSmart could not enable offline support on this device. The app can still be used while connected.'
      });
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
})();