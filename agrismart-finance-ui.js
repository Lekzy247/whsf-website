(() => {
  const reports = window.AgriSmartReports;
  if (!reports) return;

  const money = value => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: 'NGN', maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  const dashboard = document.querySelector('[data-finance-dashboard]');
  if (!dashboard) return;

  const render = () => {
    const summary = reports.getSummary();
    dashboard.querySelector('[data-total-revenue]').textContent = money(summary.totalRevenue);
    dashboard.querySelector('[data-total-expenses]').textContent = money(summary.totalExpenses);
    dashboard.querySelector('[data-estimated-profit]').textContent = money(summary.estimatedProfit);
    dashboard.querySelector('[data-harvest-count]').textContent = String(summary.harvests);

    const expenseList = dashboard.querySelector('[data-expense-list]');
    const harvestList = dashboard.querySelector('[data-harvest-list]');
    const expenses = reports.getExpenses().slice().reverse();
    const harvests = reports.getHarvests().slice().reverse();

    expenseList.innerHTML = expenses.length ? expenses.map(item => `
      <div class="order-item">
        <div><strong>${escapeHtml(item.category)}</strong><div>${escapeHtml(item.description || 'Farm expense')} · ${escapeHtml(item.date)}</div></div>
        <div style="text-align:right"><strong>${money(item.amount)}</strong><br><button class="chip" data-remove-expense="${escapeHtml(item.id)}" type="button">Remove</button></div>
      </div>`).join('') : '<div class="notice">No expense records yet.</div>';

    harvestList.innerHTML = harvests.length ? harvests.map(item => `
      <div class="order-item">
        <div><strong>${escapeHtml(item.crop)}</strong><div>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${escapeHtml(item.date)}</div></div>
        <div style="text-align:right"><strong>${money(item.revenue)}</strong><br><button class="chip" data-remove-harvest="${escapeHtml(item.id)}" type="button">Remove</button></div>
      </div>`).join('') : '<div class="notice">No harvest records yet.</div>';
  };

  dashboard.querySelector('[data-expense-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    reports.addExpense({
      category: data.get('category'),
      description: data.get('description'),
      amount: data.get('amount'),
      date: data.get('date')
    });
    event.currentTarget.reset();
    render();
  });

  dashboard.querySelector('[data-harvest-form]')?.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    reports.addHarvest({
      crop: data.get('crop'),
      quantity: data.get('quantity'),
      unit: data.get('unit'),
      revenue: data.get('revenue'),
      date: data.get('date')
    });
    event.currentTarget.reset();
    render();
  });

  dashboard.addEventListener('click', event => {
    const expenseButton = event.target.closest('[data-remove-expense]');
    const harvestButton = event.target.closest('[data-remove-harvest]');
    if (expenseButton) reports.removeRecord('expense', expenseButton.dataset.removeExpense);
    if (harvestButton) reports.removeRecord('harvest', harvestButton.dataset.removeHarvest);
    if (expenseButton || harvestButton) render();
  });

  dashboard.querySelector('[data-export-csv]')?.addEventListener('click', reports.exportCsv);
  dashboard.querySelector('[data-export-backup]')?.addEventListener('click', reports.exportBackup);
  window.addEventListener('agrismart:datachange', render);
  render();
})();