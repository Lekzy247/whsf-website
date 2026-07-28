(() => {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;

  function announceUpdate(registration) {
    window.dispatchEvent(new CustomEvent('agrismart:updateavailable', {
      detail: {
        registration,
        activate() {
          registration.waiting?.postMessage({ type: 'AGRISMART_SKIP_WAITING' });
        }
      }
    }));
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
        registration.update().catch(() => {});
        requestBackgroundSync(registration);
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
      window.dispatchEvent(new CustomEvent('agrismart:serviceworkererror', {
        detail: { message: String(error?.message || error) }
      }));
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
})();