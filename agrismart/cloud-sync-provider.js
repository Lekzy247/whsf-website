(() => {
  'use strict';

  const state = { configured: false, lastSync: null, provider: null };

  async function configure(options = {}) {
    state.provider = options.provider || null;
    state.configured = Boolean(state.provider);
    return state.configured;
  }

  async function push(record) {
    if (!state.configured) throw new Error('Cloud sync provider not configured.');
    state.lastSync = new Date().toISOString();
    return { success: true, record, provider: state.provider, lastSync: state.lastSync };
  }

  async function pull() {
    if (!state.configured) throw new Error('Cloud sync provider not configured.');
    return { success: true, data: null, provider: state.provider };
  }

  function status() {
    return { ...state };
  }

  window.AgriSmartCloudSync = Object.freeze({ configure, push, pull, status });

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadScript('/agrismart/sync-manager.js');
      await loadScript('/agrismart/sync-integration.js');
    } catch (error) {
      console.error('AgriSmart synchronization startup failed', error);
    }
  }, { once: true });
})();