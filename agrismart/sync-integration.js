(() => {
  'use strict';

  const manager = window.AgriSmartSyncManager;
  const cloud = window.AgriSmartCloudSync;
  if (!manager || !cloud) return;

  const collectionByKey = Object.freeze({
    'agrismart-farms-v1': 'farms',
    'agrismart-expenses-v1': 'expenses',
    'agrismart-harvests-v1': 'harvests',
    'agrismart-inventory-v1': 'inventory',
    'agrismart-inventory-movements-v1': 'inventoryMovements',
    'agrismart-crop-scans-v1': 'scans'
  });
  const keyByCollection = Object.fromEntries(Object.entries(collectionByKey).map(([key, collection]) => [collection, key]));
  const statusLabels = {
    idle: 'Ready', pending: 'Pending', syncing: 'Syncing', synced: 'Synced',
    error: 'Sync error', offline: 'Offline'
  };
  let initializing = false;

  function readCollection(collection) {
    try {
      const records = JSON.parse(localStorage.getItem(keyByCollection[collection]) || '[]');
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  function enqueueCollection(collection) {
    if (!keyByCollection[collection]) return;
    manager.enqueue('collection.snapshot', {
      collection,
      records: readCollection(collection)
    });
  }

  function enqueueAllCollections() {
    Object.keys(keyByCollection).forEach(enqueueCollection);
  }

  function ensureStatusBadge() {
    let badge = document.querySelector('[data-sync-status]');
    if (badge) return badge;
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'chip';
    badge.dataset.syncStatus = '';
    badge.setAttribute('aria-live', 'polite');
    badge.addEventListener('click', () => manager.flush());
    document.querySelector('.top-actions')?.prepend(badge);
    return badge;
  }

  function renderStatus(syncState) {
    const badge = ensureStatusBadge();
    const cloudState = cloud.status();
    const pending = Number(syncState.pending || 0);
    const localOnly = cloudState.mode !== 'cloud';
    const label = localOnly ? 'Saved locally' : (statusLabels[syncState.status] || syncState.status);
    badge.textContent = pending ? `${label} · ${pending}` : label;
    badge.dataset.state = localOnly ? 'local' : syncState.status;
    badge.title = syncState.lastError
      ? `${syncState.lastError}. Select to retry.`
      : localOnly
        ? 'Sign in to back up records securely to your AgriSmart cloud account.'
        : syncState.lastSync
          ? `Last cloud synchronization ${new Date(syncState.lastSync).toLocaleString()}`
          : 'Cloud synchronization is ready.';
  }

  async function initializeCloud() {
    if (initializing) return;
    initializing = true;
    try {
      const configured = await cloud.configure({ provider: 'supabase', mode: 'cloud' });
      if (configured.mode === 'cloud') {
        await cloud.hydrateLocalData();
        enqueueAllCollections();
      }
      await manager.flush();
    } catch (error) {
      console.warn('AgriSmart cloud initialization is waiting to retry.', error);
      await manager.flush();
    } finally {
      initializing = false;
      renderStatus(manager.status());
    }
  }

  manager.subscribe(renderStatus);

  window.addEventListener('agrismart:farmchange', event => {
    if (event.detail?.source !== 'cloud') enqueueCollection('farms');
  });
  window.addEventListener('agrismart:datachange', event => {
    if (event.detail?.source === 'cloud') return;
    const collection = collectionByKey[event.detail?.key];
    if (collection) enqueueCollection(collection);
  });
  window.addEventListener('agrismart:inventorychange', event => {
    if (event.detail?.source === 'cloud') return;
    const collection = collectionByKey[event.detail?.key];
    if (collection) enqueueCollection(collection);
  });
  window.addEventListener('agrismart:scanchange', event => {
    if (event.detail?.source !== 'cloud') enqueueCollection('scans');
  });
  window.addEventListener('agrismart:authchange', initializeCloud);
  window.addEventListener('agrismart:restorecomplete', enqueueAllCollections);

  initializeCloud();
})();
