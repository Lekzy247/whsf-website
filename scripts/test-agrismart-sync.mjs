import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const storage = new Map();
const cloudRows = new Map();
const session = {
  accessToken: 'test-access-token',
  expiresAt: Date.now() + 3600000,
  user: { id: '00000000-0000-4000-8000-000000000001' }
};

globalThis.localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};
globalThis.CustomEvent = class {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.window = {
  AgriSmartAuth: {
    getSession: () => session,
    refreshSession: async () => session
  },
  dispatchEvent: () => true
};
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const method = String(options.method || 'GET').toUpperCase();
  const recordType = url.searchParams.get('record_type')?.replace(/^eq\./, '');

  if (method === 'GET') {
    const rows = [...cloudRows.values()].filter(row => !recordType || row.record_type === recordType);
    return response(rows);
  }

  if (method === 'POST') {
    const rows = JSON.parse(options.body || '[]');
    rows.forEach(row => cloudRows.set(`${row.owner_id}:${row.id}`, {
      ...row,
      updated_at: new Date().toISOString()
    }));
    return response(null);
  }

  if (method === 'DELETE') {
    const ownerId = url.searchParams.get('owner_id')?.replace(/^eq\./, '');
    const id = url.searchParams.get('id')?.replace(/^eq\./, '');
    cloudRows.delete(`${ownerId}:${id}`);
    return response(null);
  }

  return response({ message: 'Unsupported method' }, false, 405);
};

function response(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload
  };
}

const providerSource = await readFile(new URL('../agrismart/cloud-sync-provider.js', import.meta.url), 'utf8');
vm.runInThisContext(providerSource, { filename: 'agrismart/cloud-sync-provider.js' });

const provider = window.AgriSmartCloudSync;
const configured = await provider.configure({ provider: 'supabase', mode: 'cloud' });
assert.equal(configured.mode, 'cloud');

const farm = {
  id: 'farm-local-1',
  name: 'Demo farm',
  crop: 'Maize',
  updatedAt: '2026-07-29T12:00:00.000Z'
};
await provider.push({
  id: 'queue-1',
  action: 'collection.snapshot',
  payload: { collection: 'farms', records: [farm] }
});
assert.ok(cloudRows.has(`${session.user.id}:farms:farm-local-1`), 'farm snapshot was uploaded');
assert.ok(cloudRows.has(`${session.user.id}:farms:__snapshot__`), 'empty-state marker was uploaded');

await provider.push({
  id: 'queue-2',
  action: 'collection.snapshot',
  payload: { collection: 'farms', records: [] }
});
assert.ok(!cloudRows.has(`${session.user.id}:farms:farm-local-1`), 'removed farm was deleted remotely');
assert.ok(cloudRows.has(`${session.user.id}:farms:__snapshot__`), 'empty collection remains authoritative');

cloudRows.set(`${session.user.id}:expenses:expense-cloud-1`, {
  id: 'expenses:expense-cloud-1',
  owner_id: session.user.id,
  record_type: 'expenses',
  payload: {
    id: 'expense-cloud-1',
    category: 'Seeds',
    amount: 12500,
    currency: 'NGN',
    date: '2026-07-29'
  },
  updated_at: new Date().toISOString()
});
cloudRows.set(`${session.user.id}:expenses:__snapshot__`, {
  id: 'expenses:__snapshot__',
  owner_id: session.user.id,
  record_type: 'expenses',
  payload: { _meta: true, collection: 'expenses' },
  updated_at: new Date().toISOString()
});

const restored = await provider.hydrateLocalData();
assert.equal(restored.success, true);
assert.deepEqual(JSON.parse(localStorage.getItem('agrismart-expenses-v1')), [{
  id: 'expense-cloud-1',
  category: 'Seeds',
  amount: 12500,
  currency: 'NGN',
  date: '2026-07-29'
}]);
assert.deepEqual(JSON.parse(localStorage.getItem('agrismart-farms-v1')), []);

localStorage.setItem('agrismart.cloud.owner.v1', '00000000-0000-4000-8000-000000000099');
localStorage.setItem('agrismart-farms-v1', JSON.stringify([{ id: 'other-user-farm', name: 'Private farm' }]));
await provider.configure({ provider: 'supabase', mode: 'cloud' });
assert.deepEqual(
  JSON.parse(localStorage.getItem('agrismart-farms-v1')),
  [],
  'switching accounts clears the previous account cache before cloud restore'
);

console.log('AgriSmart cloud synchronization tests passed.');
