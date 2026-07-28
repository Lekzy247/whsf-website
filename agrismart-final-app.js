(() => {
  'use strict';

  const reports = window.AgriSmartReports;
  const inventory = window.AgriSmartInventory;
  const advisor = window.AgriSmartAdvisor;
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const today = () => new Date().toISOString().slice(0, 10);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  const money = value => currency.format(Number(value) || 0);

  function toast(message, type = 'success') {
    let container = document.querySelector('.agrismart-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'agrismart-toast-container';
      Object.assign(container.style, { position:'fixed', right:'18px', bottom:'84px', zIndex:'9999', display:'grid', gap:'10px', maxWidth:'360px' });
      document.body.appendChild(container);
    }
    const item = document.createElement('div');
    item.setAttribute('role', 'status');
    item.setAttribute('aria-live', 'polite');
    item.textContent = message;
    Object.assign(item.style, { padding:'13px 16px', borderRadius:'12px', color:'#fff', background:type === 'error' ? '#a52a2a' : '#0d4d35', boxShadow:'0 12px 32px rgba(0,0,0,.2)', fontWeight:'700' });
    container.appendChild(item);
    setTimeout(() => item.remove(), 3400);
  }

  function configurePwa() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/agrismart/manifest.webmanifest';
      document.head.appendChild(manifest);
    }
  }

  function configureDataRestore() {
    if (!reports?.importBackup || document.querySelector('[data-import-backup]')) return;
    const backupButton = document.querySelector('[data-export-backup]');
    if (!backupButton) return;

    const importButton = document.createElement('button');
    importButton.className = 'secondary-btn';
    importButton.type = 'button';
    importButton.dataset.importBackup = '';
    importButton.textContent = 'Restore Backup';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.hidden = true;
    fileInput.setAttribute('aria-label', 'Select an AgriSmart backup file');

    backupButton.insertAdjacentElement('afterend', importButton);
    importButton.insertAdjacentElement('afterend', fileInput);

    importButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const approved = confirm('Restoring this backup will replace the current farm, expense and harvest records on this device. Continue?');
      if (!approved) { fileInput.value = ''; return; }

      importButton.disabled = true;
      importButton.textContent = 'Restoring...';
      try {
        const summary = await reports.importBackup(file);
        renderAll();
        toast(`Backup restored: ${summary.farms} farms, ${summary.expenses} expenses and ${summary.harvests} harvests.`);
      } catch (error) {
        toast(error.message || 'Unable to restore this backup.', 'error');
      } finally {
        fileInput.value = '';
        importButton.disabled = false;
        importButton.textContent = 'Restore Backup';
      }
    });
  }

  function setDefaultDates() {
    document.querySelectorAll('input[type="date"]').forEach(input => { if (!input.value) input.value = today(); });
  }

  function renderFinance() {
    if (!reports) return;
    const summary = reports.getSummary();
    const root = document.querySelector('[data-finance-dashboard]');
    if (root) {
      const values = {
        '[data-total-revenue]': money(summary.totalRevenue),
        '[data-total-expenses]': money(summary.totalExpenses),
        '[data-estimated-profit]': money(summary.estimatedProfit),
        '[data-harvest-count]': String(summary.harvests)
      };
      Object.entries(values).forEach(([selector, value]) => { const el = root.querySelector(selector); if (el) el.textContent = value; });
      const expenses = root.querySelector('[data-expense-list]');
      if (expenses) expenses.innerHTML = reports.getExpenses().slice().reverse().map(item => `<div class="order-item"><div><strong>${escapeHtml(item.category)}</strong><div>${escapeHtml(item.description || 'Farm expense')} · ${escapeHtml(item.date)}</div></div><div><strong>${money(item.amount)}</strong> <button class="secondary-btn" data-remove-expense="${escapeHtml(item.id)}" type="button">Remove</button></div></div>`).join('') || '<div class="notice">No expenses recorded.</div>';
      const harvests = root.querySelector('[data-harvest-list]');
      if (harvests) harvests.innerHTML = reports.getHarvests().slice().reverse().map(item => `<div class="order-item"><div><strong>${escapeHtml(item.crop)}</strong><div>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${escapeHtml(item.date)}</div></div><div><strong>${money(item.revenue)}</strong> <button class="secondary-btn" data-remove-harvest="${escapeHtml(item.id)}" type="button">Remove</button></div></div>`).join('') || '<div class="notice">No harvests recorded.</div>';
    }
  }

  function renderInventory() {
    if (!inventory) return;
    const root = document.querySelector('[data-inventory-dashboard]');
    if (!root) return;
    const summary = inventory.getSummary();
    const values = { '[data-inventory-count]': summary.itemCount, '[data-inventory-low]': summary.lowStockCount, '[data-inventory-out]': summary.outOfStockCount, '[data-inventory-categories]': summary.categoryCount };
    Object.entries(values).forEach(([selector, value]) => { const el = root.querySelector(selector); if (el) el.textContent = String(value); });
    const items = inventory.getItems();
    const select = root.querySelector('[data-item-select]');
    if (select) select.innerHTML = '<option value="">Select item</option>' + items.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (${escapeHtml(item.quantity)} ${escapeHtml(item.unit)})</option>`).join('');
    const list = root.querySelector('[data-inventory-list]');
    if (list) list.innerHTML = items.map(item => `<div class="order-item"><div><strong>${escapeHtml(item.name)}</strong><div>${escapeHtml(item.category)} · Reorder at ${escapeHtml(item.reorderLevel)} ${escapeHtml(item.unit)}${item.supplier ? ` · ${escapeHtml(item.supplier)}` : ''}</div></div><div><span class="chip">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</span> <button class="secondary-btn" data-remove-item="${escapeHtml(item.id)}" type="button">Remove</button></div></div>`).join('') || '<div class="notice">No inventory items recorded.</div>';
  }

  function renderOperations() {
    if (!reports || !inventory) return;
    const root = document.querySelector('[data-operations-dashboard]');
    if (!root) return;
    const finance = reports.getSummary();
    const stock = inventory.getSummary();
    const margin = finance.totalRevenue ? (finance.estimatedProfit / finance.totalRevenue) * 100 : 0;
    const values = { '[data-ops-revenue]': money(finance.totalRevenue), '[data-ops-expenses]': money(finance.totalExpenses), '[data-ops-profit]': money(finance.estimatedProfit), '[data-ops-margin]': `${margin.toFixed(1)}%`, '[data-ops-low-stock]': stock.lowStockCount, '[data-ops-out-stock]': stock.outOfStockCount };
    Object.entries(values).forEach(([selector, value]) => { const el = root.querySelector(selector); if (el) el.textContent = String(value); });

    const alerts = root.querySelector('[data-operations-alerts]');
    if (alerts) alerts.innerHTML = stock.lowStock.length ? stock.lowStock.slice(0, 5).map(item => `<article><strong>${escapeHtml(item.name)} is low</strong><p>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} remaining. Reorder threshold: ${escapeHtml(item.reorderLevel)}.</p></article>`).join('') : '<div class="notice">No urgent inventory alerts.</div>';

    const activity = [
      ...reports.getExpenses().map(item => ({ date:item.createdAt || item.date, title:item.category, detail:`Expense · ${money(item.amount)}` })),
      ...reports.getHarvests().map(item => ({ date:item.createdAt || item.date, title:item.crop, detail:`Harvest · ${item.quantity} ${item.unit} · ${money(item.revenue)}` })),
      ...inventory.getMovements().map(item => ({ date:item.createdAt || item.date, title:item.itemName, detail:`${item.type === 'in' ? 'Stock received' : 'Stock used'} · ${item.quantity} ${item.unit}` }))
    ].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 8);
    const list = root.querySelector('[data-recent-activity]');
    if (list) list.innerHTML = activity.map(item => `<div class="order-item"><div><strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(item.detail)}</div></div><span class="chip">${escapeHtml(String(item.date).slice(0,10))}</span></div>`).join('') || '<div class="notice">No recent activity.</div>';
  }

  function renderAll() { renderFinance(); renderInventory(); renderOperations(); }

  document.querySelector('[data-expense-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    try { reports.addExpense(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); setDefaultDates(); toast('Expense saved.'); renderAll(); }
    catch (error) { toast(error.message || 'Unable to save expense.', 'error'); }
  });

  document.querySelector('[data-harvest-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    try { reports.addHarvest(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); setDefaultDates(); toast('Harvest saved.'); renderAll(); }
    catch (error) { toast(error.message || 'Unable to save harvest.', 'error'); }
  });

  document.querySelector('[data-inventory-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    try { inventory.addItem(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); toast('Inventory item added.'); renderAll(); }
    catch (error) { toast(error.message || 'Unable to add inventory.', 'error'); }
  });

  document.querySelector('[data-movement-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    try { inventory.recordMovement(Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); toast('Stock movement recorded.'); renderAll(); }
    catch (error) { toast(error.message || 'Unable to record stock movement.', 'error'); }
  });

  document.addEventListener('click', event => {
    const expense = event.target.closest('[data-remove-expense]');
    const harvest = event.target.closest('[data-remove-harvest]');
    const item = event.target.closest('[data-remove-item]');
    if (expense && confirm('Remove this expense record?')) { reports.removeRecord('expense', expense.dataset.removeExpense); renderAll(); }
    if (harvest && confirm('Remove this harvest record?')) { reports.removeRecord('harvest', harvest.dataset.removeHarvest); renderAll(); }
    if (item && confirm('Remove this inventory item?')) { inventory.removeItem(item.dataset.removeItem); renderAll(); }
  });

  document.querySelector('[data-export-csv]')?.addEventListener('click', () => reports?.exportCsv());
  document.querySelector('[data-export-backup]')?.addEventListener('click', () => reports?.exportBackup());
  document.querySelector('[data-export-inventory]')?.addEventListener('click', () => inventory?.exportCsv());

  document.querySelector('[data-advisor-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const results = advisor?.recommend(data) || [];
    const target = document.querySelector('[data-advisor-results]');
    if (target) target.innerHTML = results.map(item => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.action)}</p><span class="chip">${escapeHtml(item.level)}</span></article>`).join('');
  });

  document.querySelector('[data-use-location]')?.addEventListener('click', () => {
    const status = document.querySelector('[data-location-status]');
    if (!navigator.geolocation) { if (status) status.textContent = 'Location is not supported by this browser.'; return; }
    if (status) status.textContent = 'Requesting location permission...';
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      localStorage.setItem('agrismart-last-location', JSON.stringify({ latitude, longitude, capturedAt:new Date().toISOString() }));
      if (status) status.textContent = `Location saved: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      toast('Farm location saved.');
    }, () => { if (status) status.textContent = 'Location permission was denied or unavailable.'; }, { enableHighAccuracy:true, timeout:10000 });
  });

  const connectivity = document.querySelector('[data-connectivity]');
  function updateConnectivity() {
    if (!connectivity) return;
    connectivity.textContent = navigator.onLine ? 'Online' : 'Offline';
    connectivity.dataset.state = navigator.onLine ? 'online' : 'offline';
  }
  window.addEventListener('online', updateConnectivity);
  window.addEventListener('offline', updateConnectivity);
  window.addEventListener('agrismart:datachange', renderAll);
  window.addEventListener('agrismart:inventorychange', renderAll);

  let installPrompt = null;
  const installButton = document.querySelector('[data-install-app]');
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function updateInstallButton() {
    if (!installButton) return;
    if (isStandalone()) {
      installButton.textContent = 'App Installed';
      installButton.disabled = true;
      installButton.hidden = false;
      return;
    }
    installButton.disabled = false;
    installButton.hidden = !installPrompt;
    installButton.textContent = 'Install App';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstallButton();
    toast('AgriSmart has been installed successfully.');
  });

  installButton?.addEventListener('click', async () => {
    if (isStandalone()) return;
    if (!installPrompt) {
      toast('Installation is not available yet. Use your browser menu to add AgriSmart to your device.', 'error');
      return;
    }
    installButton.disabled = true;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome !== 'accepted') toast('Installation was cancelled.', 'error');
    } finally {
      installPrompt = null;
      updateInstallButton();
    }
  });

  configurePwa();
  configureDataRestore();
  setDefaultDates();
  updateConnectivity();
  updateInstallButton();
  renderAll();
})();