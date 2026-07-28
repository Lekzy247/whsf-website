(() => {
  'use strict';

  const queue = window.AgriSmartSyncQueue;
  const cloud = window.AgriSmartCloudSync;
  const listeners = new Set();
  const state = {
    status: navigator.onLine ? 'idle' : 'offline',
    pending: queue?.pending?.().length || 0,
    lastSync: null,
    lastError: null,
    retryAttempt: 0
  };

  let syncing = false;
  let retryTimer = null;

  function snapshot() {
    return { ...state, online: navigator.onLine };
  }

  function emit() {
    state.pending = queue?.pending?.().length || 0;
    const detail = snapshot();
    listeners.forEach(listener => listener(detail));
    window.dispatchEvent(new CustomEvent('agrismart:syncstatus', { detail }));
  }

  function setStatus(status, error = null) {
    state.status = status;
    state.lastError = error ? String(error.message || error) : null;
    emit();
  }

  function clearRetry() {
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function scheduleRetry() {
    clearRetry();
    if (!navigator.onLine || !state.pending) return;
    const delay = Math.min(60000, 1000 * (2 ** Math.min(state.retryAttempt, 6)));
    retryTimer = window.setTimeout(() => flush(), delay);
  }

  function enqueue(action, payload) {
    if (!queue?.enqueue) return 0;
    const pending = queue.enqueue(action, payload);
    state.pending = pending;
    setStatus(navigator.onLine ? 'pending' : 'offline');
    if (navigator.onLine) flush();
    return pending;
  }

  async function flush() {
    if (syncing || !queue?.dequeue || !cloud?.push) return snapshot();
    if (!navigator.onLine) {
      setStatus('offline');
      return snapshot();
    }

    const cloudStatus = cloud.status?.() || {};
    if (!cloudStatus.configured) {
      setStatus(state.pending ? 'pending' : 'idle');
      return snapshot();
    }

    syncing = true;
    clearRetry();
    setStatus('syncing');

    try {
      let item = queue.dequeue();
      while (item) {
        try {
          const result = await cloud.push(item);
          state.lastSync = result?.lastSync || new Date().toISOString();
          state.retryAttempt = 0;
          item = queue.dequeue();
        } catch (error) {
          queue.enqueue(item.action, {
            ...item.payload,
            _sync: {
              originalId: item.id,
              createdAt: item.createdAt,
              retryCount: Number(item.payload?._sync?.retryCount || 0) + 1
            }
          });
          state.retryAttempt += 1;
          throw error;
        }
      }
      setStatus('synced');
    } catch (error) {
      setStatus('error', error);
      scheduleRetry();
    } finally {
      syncing = false;
      emit();
    }

    return snapshot();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }

  window.addEventListener('online', () => {
    setStatus(state.pending ? 'pending' : 'idle');
    flush();
  });
  window.addEventListener('offline', () => {
    clearRetry();
    setStatus('offline');
  });
  navigator.serviceWorker?.addEventListener('message', event => {
    if (event.data?.type === 'AGRISMART_CONNECTIVITY' && event.data.online) flush();
    if (event.data?.type === 'AGRISMART_SYNC_REQUEST') flush();
  });

  window.AgriSmartSyncManager = Object.freeze({ enqueue, flush, subscribe, status: snapshot });
  emit();
})();