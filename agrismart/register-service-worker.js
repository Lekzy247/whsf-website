if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/agrismart/service-worker.js');
      console.log('AgriSmart service worker registered:', reg.scope);
    } catch (err) {
      console.error('Service worker registration failed', err);
    }
  });
}
