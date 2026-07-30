(() => {
  'use strict';

  const SUPABASE_URL = 'https://ophymlgqnfilgxsuzcuz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_tA1TRg0XkBKKXZ5UwFbu4Q_qGIST2Xh';
  const JOURNAL_KEY = 'agrismart.sync.journal.v1';
  const OWNER_KEY = 'agrismart.cloud.owner.v1';
  const COLLECTIONS = Object.freeze({
    farms: { key: 'agrismart-farms-v1', event: 'agrismart:farmchange' },
    expenses: { key: 'agrismart-expenses-v1', event: 'agrismart:datachange' },
    harvests: { key: 'agrismart-harvests-v1', event: 'agrismart:datachange' },
    inventory: { key: 'agrismart-inventory-v1', event: 'agrismart:inventorychange' },
    inventoryMovements: { key: 'agrismart-inventory-movements-v1', event: 'agrismart:inventorychange' },
    scans: { key: 'agrismart-crop-scans-v1', event: 'agrismart:scanchange' }
  });
  const state = {
    configured: false,
    lastSync: null,
    provider: null,
    mode: 'local',
    recordsStored: 0,
    userId: null
  };

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function readJournal() {
    const value = readJson(JOURNAL_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function writeJournal(records) {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(records.slice(-250)));
    state.recordsStored = Math.min(records.length, 250);
  }

  function journalRecord(record) {
    const journal = readJournal();
    const entry = {
      ...record,
      synchronizedAt: new Date().toISOString(),
      provider: state.provider
    };
    const existingIndex = journal.findIndex(item => item.id && entry.id && item.id === entry.id);
    if (existingIndex >= 0) journal[existingIndex] = entry;
    else journal.push(entry);
    writeJournal(journal);
    return entry;
  }

  async function activeSession() {
    let session = window.AgriSmartAuth?.getSession?.();
    if (session?.expiresAt && session.expiresAt <= Date.now() + 60000) {
      await window.AgriSmartAuth?.refreshSession?.().catch(() => null);
      session = window.AgriSmartAuth?.getSession?.();
    }
    return session?.accessToken && session?.user?.id ? session : null;
  }

  async function request(path, options = {}) {
    const session = await activeSession();
    if (!session) throw new Error('Sign in to synchronize farm records with the cloud.');

    let response;
    try {
      response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error('Cloud synchronization could not be reached. Your changes remain safely queued on this device.');
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || payload?.details || payload?.hint || `Cloud synchronization failed (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  }

  function recordTime(record) {
    const value = record?.updatedAt || record?.createdAt || new Date().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  async function fetchCloudRecords(collection) {
    const filter = collection ? `&record_type=eq.${encodeURIComponent(collection)}` : '';
    const result = await request(`/rest/v1/sync_records?select=id,record_type,payload,client_updated_at,updated_at&order=updated_at.asc${filter}`);
    return Array.isArray(result) ? result : [];
  }

  async function pushSnapshot(payload = {}) {
    const collection = String(payload.collection || '');
    const definition = COLLECTIONS[collection];
    if (!definition) throw new Error(`Unsupported synchronization collection: ${collection || 'unknown'}.`);

    const session = await activeSession();
    if (!session) throw new Error('Sign in to synchronize farm records with the cloud.');
    const records = Array.isArray(payload.records) ? payload.records.filter(record => record && record.id != null) : [];
    const remote = await fetchCloudRecords(collection);
    const snapshotId = `${collection}:__snapshot__`;
    const localIds = new Set([snapshotId, ...records.map(record => `${collection}:${String(record.id)}`)]);

    {
      const rows = records.map(record => ({
        id: `${collection}:${String(record.id)}`,
        owner_id: session.user.id,
        record_type: collection,
        payload: record,
        client_updated_at: recordTime(record)
      }));
      rows.push({
        id: snapshotId,
        owner_id: session.user.id,
        record_type: collection,
        payload: { _meta: true, collection, snapshotAt: new Date().toISOString() },
        client_updated_at: new Date().toISOString()
      });
      await request('/rest/v1/sync_records?on_conflict=owner_id,id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows)
      });
    }

    const removed = remote.filter(record => !localIds.has(String(record.id)));
    for (const record of removed) {
      await request(`/rest/v1/sync_records?owner_id=eq.${encodeURIComponent(session.user.id)}&id=eq.${encodeURIComponent(record.id)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
    }

    return { collection, uploaded: records.length, removed: removed.length };
  }

  async function configure(options = {}) {
    const session = await activeSession();
    const wantsCloud = options.provider === 'supabase' || options.mode === 'cloud' || options.provider == null;
    const previousOwner = localStorage.getItem(OWNER_KEY);
    if (session?.user?.id && previousOwner && previousOwner !== session.user.id) {
      Object.entries(COLLECTIONS).forEach(([collection, definition]) => {
        localStorage.setItem(definition.key, '[]');
        window.dispatchEvent(new CustomEvent(definition.event, {
          detail: { key: definition.key, source: 'cloud', collection }
        }));
      });
    }
    state.provider = wantsCloud && session ? 'supabase' : 'local-journal';
    state.mode = wantsCloud && session ? 'cloud' : 'local';
    state.userId = session?.user?.id || null;
    state.configured = true;
    state.recordsStored = readJournal().length;
    return status();
  }

  async function push(record) {
    if (!state.configured) throw new Error('Synchronization provider not configured.');
    if (!record || typeof record !== 'object') throw new Error('Invalid synchronization record.');

    let cloudResult = null;
    if (state.mode === 'cloud' && record.action === 'collection.snapshot') {
      cloudResult = await pushSnapshot(record.payload);
    }

    const entry = journalRecord(record);
    state.lastSync = entry.synchronizedAt;
    return {
      success: true,
      record: entry,
      cloudResult,
      provider: state.provider,
      mode: state.mode,
      lastSync: state.lastSync,
      recordsStored: state.recordsStored
    };
  }

  async function pull() {
    if (!state.configured) throw new Error('Synchronization provider not configured.');
    if (state.mode !== 'cloud') {
      const data = readJournal();
      state.recordsStored = data.length;
      return { success: true, data, provider: state.provider, mode: state.mode };
    }
    const data = await fetchCloudRecords();
    return { success: true, data, provider: state.provider, mode: state.mode };
  }

  async function hydrateLocalData() {
    if (!state.configured || state.mode !== 'cloud' || !state.userId) {
      return { success: false, restored: 0, reason: 'local-mode' };
    }

    const remote = await fetchCloudRecords();
    const previousOwner = localStorage.getItem(OWNER_KEY);
    const ownerChanged = Boolean(previousOwner && previousOwner !== state.userId);
    let restored = 0;

    Object.entries(COLLECTIONS).forEach(([collection, definition]) => {
      const cloudEntries = remote
        .filter(record => record.record_type === collection && record.payload && typeof record.payload === 'object');
      const cloudRecords = cloudEntries
        .filter(record => !record.payload._meta)
        .map(record => ({
          ...record.payload,
          id: String(record.payload.id ?? record.id.replace(`${collection}:`, ''))
        }));
      const localRecords = readJson(definition.key, []);
      const shouldRestore = ownerChanged || cloudEntries.length > 0 || !Array.isArray(localRecords);
      if (!shouldRestore) return;

      localStorage.setItem(definition.key, JSON.stringify(cloudRecords));
      restored += cloudRecords.length;
      window.dispatchEvent(new CustomEvent(definition.event, {
        detail: { key: definition.key, source: 'cloud', collection }
      }));
    });

    localStorage.setItem(OWNER_KEY, state.userId);
    window.dispatchEvent(new CustomEvent('agrismart:cloudrestore', { detail: { restored, ownerChanged } }));
    return { success: true, restored, ownerChanged };
  }

  async function clearLocalJournal() {
    localStorage.removeItem(JOURNAL_KEY);
    state.recordsStored = 0;
    return true;
  }

  function status() {
    return { ...state };
  }

  window.AgriSmartCloudSync = Object.freeze({
    configure,
    push,
    pull,
    hydrateLocalData,
    status,
    clearLocalJournal,
    collections: COLLECTIONS
  });
})();
