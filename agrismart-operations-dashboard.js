(() => {
  const reports = window.AgriSmartReports;
  const inventory = window.AgriSmartInventory;
  const root = document.querySelector('[data-operations-dashboard]');
  if (!root || !reports || !inventory) return;

  const money = value => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));

  const setText = (selector, value) => {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  };

  const renderAlerts = inventorySummary => {
    const list = root.querySelector('[data-operations-alerts]');
    if (!list) return;

    const alerts = [];
    inventorySummary.lowStock.slice(0, 5).forEach(item => {
      alerts.push(`
        <article class="order-item" style="display:block">
          <strong>Low stock: ${escapeHtml(item.name)}</strong>
          <p>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} remaining; reorder level is ${escapeHtml(item.reorderLevel)}.</p>
        </article>`);
    });

    if (inventorySummary.outOfStockCount > 0) {
      alerts.unshift(`
        <article class="order-item" style="display:block">
          <strong>Out-of-stock attention required</strong>
          <p>${inventorySummary.outOfStockCount} inventory item${inventorySummary.outOfStockCount === 1 ? '' : 's'} currently have no available stock.</p>
        </article>`);
    }

    list.innerHTML = alerts.length
      ? alerts.join('')
      : '<div class="notice">No urgent operational alerts. Inventory levels are currently within configured thresholds.</div>';
  };

  const renderActivity = () => {
    const list = root.querySelector('[data-recent-activity]');
    if (!list) return;

    const harvests = reports.getHarvests().map(item => ({
      type: 'Harvest',
      title: item.crop,
      detail: `${item.quantity} ${item.unit} · ${money(item.revenue)}`,
      date: item.createdAt || item.date || ''
    }));

    const expenses = reports.getExpenses().map(item => ({
      type: 'Expense',
      title: item.category,
      detail: `${item.description || 'Farm expense'} · ${money(item.amount)}`,
      date: item.createdAt || item.date || ''
    }));

    const movements = inventory.getMovements().map(item => ({
      type: item.type === 'in' ? 'Stock received' : 'Stock used',
      title: item.itemName,
      detail: `${item.quantity} ${item.unit} · ${item.reason}`,
      date: item.createdAt || item.date || ''
    }));

    const activity = [...harvests, ...expenses, ...movements]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8);

    list.innerHTML = activity.length
      ? activity.map(item => `
          <div class="order-item">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <div>${escapeHtml(item.type)} · ${escapeHtml(item.detail)}</div>
            </div>
            <span class="chip">${escapeHtml(String(item.date).slice(0, 10))}</span>
          </div>`).join('')
      : '<div class="notice">No operational activity has been recorded yet.</div>';
  };

  const render = () => {
    const finance = reports.getSummary();
    const stock = inventory.getSummary();

    setText('[data-ops-revenue]', money(finance.totalRevenue));
    setText('[data-ops-expenses]', money(finance.totalExpenses));
    setText('[data-ops-profit]', money(finance.estimatedProfit));
    setText('[data-ops-farms]', String(finance.farms));
    setText('[data-ops-area]', `${Number(finance.totalArea || 0).toFixed(1)} ha`);
    setText('[data-ops-harvests]', String(finance.harvests));
    setText('[data-ops-inventory]', String(stock.itemCount));
    setText('[data-ops-low-stock]', String(stock.lowStockCount));
    setText('[data-ops-out-stock]', String(stock.outOfStockCount));

    const margin = finance.totalRevenue > 0
      ? (finance.estimatedProfit / finance.totalRevenue) * 100
      : 0;
    setText('[data-ops-margin]', `${margin.toFixed(1)}%`);

    renderAlerts(stock);
    renderActivity();
  };

  root.querySelector('[data-ops-export-reports]')?.addEventListener('click', () => reports.exportCsv());
  root.querySelector('[data-ops-export-inventory]')?.addEventListener('click', () => inventory.exportCsv());
  root.querySelector('[data-ops-backup]')?.addEventListener('click', () => reports.exportBackup());

  root.querySelectorAll('[data-ops-view]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.opsView;
      const appButton = document.querySelector(`[data-view="${CSS.escape(target)}"]`);
      appButton?.click();
    });
  });

  window.addEventListener('agrismart:datachange', render);
  window.addEventListener('agrismart:inventorychange', render);
  render();
})();