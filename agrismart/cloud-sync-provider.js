(() => {
  'use strict';

  const JOURNAL_KEY = 'agrismart.sync.journal.v1';
  const state = {
    configured: false,
    lastSync: null,
    provider: null,
    mode: 'local',
    recordsStored: 0
  };

  function readJournal() {
    try {
      const value = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      console.warn('AgriSmart sync journal could not be read.', error);
      return [];
    }
  }

  function writeJournal(records) {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(records));
    state.recordsStored = records.length;
  }

  async function configure(options = {}) {
    state.provider = options.provider || 'local-journal';
    state.mode = options.mode || 'local';
    state.configured = true;
    state.recordsStored = readJournal().length;
    return status();
  }

  async function push(record) {
    if (!state.configured) throw new Error('Synchronization provider not configured.');
    if (!record || typeof record !== 'object') throw new Error('Invalid synchronization record.');

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
    state.lastSync = entry.synchronizedAt;

    return {
      success: true,
      record: entry,
      provider: state.provider,
      mode: state.mode,
      lastSync: state.lastSync,
      recordsStored: state.recordsStored
    };
  }

  async function pull() {
    if (!state.configured) throw new Error('Synchronization provider not configured.');
    const data = readJournal();
    state.recordsStored = data.length;
    return { success: true, data, provider: state.provider, mode: state.mode };
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
    status,
    clearLocalJournal
  });
})();