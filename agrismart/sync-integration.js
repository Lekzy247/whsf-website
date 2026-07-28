(() => {
  'use strict';

  const manager = window.AgriSmartSyncManager;
  const cloud = window.AgriSmartCloudSync;
  if (!manager) return;

  cloud?.configure?.({ provider: 'local-demo' }).then(() => manager.flush());

  const statusLabels = {
    idle: 'Ready', pending: 'Pending', syncing: 'Syncing', synced: 'Synced',
    error: 'Sync error', offline: 'Offline'
  };

  function ensureStatusBadge() {
    let badge = document.querySelector('[data-sync-status]');
    if (badge) return badge;
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'chip';
    badge.dataset.syncStatus = '';
    badge.setAttribute('aria-live', 'polite');
    badge.title = 'Select to retry synchronization';
    badge.addEventListener('click', () => manager.flush());
    document.querySelector('.top-actions')?.prepend(badge);
    return badge;
  }

  function renderStatus(state) {
    const badge = ensureStatusBadge();
    const pending = Number(state.pending || 0);
    const label = statusLabels[state.status] || state.status;
    badge.textContent = pending ? `${label} · ${pending}` : label;
    badge.dataset.state = state.status;
    badge.title = state.lastError
      ? `${state.lastError}. Select to retry.`
      : state.lastSync
        ? `Last synchronized ${new Date(state.lastSync).toLocaleString()}`
        : 'Offline-first synchronization status';
  }

  manager.subscribe(renderStatus);

  function formPayload(form) {
    return Object.fromEntries(new FormData(form));
  }

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const payload = formPayload(form);

    if (form.matches('#farm-form')) manager.enqueue('farm.create', payload);
    if (form.matches('[data-expense-form]')) manager.enqueue('expense.create', payload);
    if (form.matches('[data-harvest-form]')) manager.enqueue('harvest.create', payload);
    if (form.matches('[data-inventory-form]')) manager.enqueue('inventory.create', payload);
    if (form.matches('[data-movement-form]')) manager.enqueue('inventory.movement', payload);
  }, true);

  document.addEventListener('click', event => {
    const expense = event.target.closest('[data-remove-expense]');
    const harvest = event.target.closest('[data-remove-harvest]');
    const item = event.target.closest('[data-remove-item]');
    const farm = event.target.closest('[data-saved-farm] button');

    if (expense) manager.enqueue('expense.delete', { id: expense.dataset.removeExpense });
    if (harvest) manager.enqueue('harvest.delete', { id: harvest.dataset.removeHarvest });
    if (item) manager.enqueue('inventory.delete', { id: item.dataset.removeItem });
    if (farm) {
      const row = farm.closest('[data-saved-farm]');
      manager.enqueue('farm.delete', { name: row?.querySelector('strong')?.textContent || '' });
    }
  }, true);

  window.addEventListener('agrismart:datachange', () => manager.flush());
  window.addEventListener('agrismart:inventorychange', () => manager.flush());
})();